<script lang="ts">
	import Button from '#lib/components/ui/button/button.svelte';
	import * as Dialog from '#lib/components/ui/dialog/index.js';
	import * as NativeSelect from '#lib/components/ui/native-select/index.js';
	import * as Table from '#lib/components/ui/table/index.js';
	import Spinner from '#lib/components/ui/spinner/spinner.svelte';
	import { importTransactions } from '#lib/remotes/transaction.remote.js';
	import { FileSpreadsheet, TriangleAlert } from '@lucide/svelte';
	import { PLATFORMS } from '#lib/platforms.js';
	import { formatCurrency } from '#lib/utils.js';

	let {
		holdingId,
		open = $bindable(false)
	}: {
		holdingId: string;
		open?: boolean;
	} = $props();

	interface CsvRow {
		type: 'buy' | 'sell' | 'reinvestment';
		transactionDate: string;
		quantity: number;
		/** Dollars, as the form and the server's add path take them. */
		pricePerUnit: number;
		brokerage: number;
	}

	let fileName = $state('');
	let rows = $state<CsvRow[]>([]);
	/** Lines that could not be read, reported rather than silently dropped. */
	let skipped = $state<string[]>([]);
	let problem = $state('');
	let platform = $state('');
	let saving = $state(false);
	let dragging = $state(false);
	let fileInput = $state<HTMLInputElement>();

	function splitLine(line: string): string[] {
		const values: string[] = [];
		let current = '';
		let inQuotes = false;
		for (const char of line) {
			if (char === '"') inQuotes = !inQuotes;
			else if (char === ',' && !inQuotes) {
				values.push(current.trim());
				current = '';
			} else current += char;
		}
		values.push(current.trim());
		return values;
	}

	const money = (raw: string | undefined) =>
		Math.round((parseFloat((raw ?? '').replace(/[$,\s]/g, '')) || 0) * 100) / 100;

	async function readCsv(file: File) {
		problem = '';
		skipped = [];
		rows = [];
		fileName = file.name;

		if (!/\.csv$/i.test(file.name)) {
			problem = `${file.name} is not a CSV file.`;
			return;
		}

		const lines = (await file.text()).trim().split(/\r?\n/).map(splitLine);
		if (lines.length < 2) {
			problem = 'The file has no rows under its header.';
			return;
		}

		const headers = lines[0].map((h) => h.toLowerCase());
		const col = (test: (h: string) => boolean) => headers.findIndex(test);
		const typeIdx = col((h) => h.includes('type'));
		const dateIdx = col((h) => h.includes('date'));
		const qtyIdx = col((h) => h.includes('qty') || h.includes('quantity'));
		const priceIdx = col((h) => h.includes('price'));
		const brokerageIdx = col((h) => h.includes('brokerage'));

		const missing = [
			typeIdx === -1 && 'Type',
			dateIdx === -1 && 'Date',
			qtyIdx === -1 && 'Quantity',
			priceIdx === -1 && 'Price'
		].filter(Boolean);
		if (missing.length > 0) {
			problem = `The header is missing ${missing.join(', ')}.`;
			return;
		}

		lines.slice(1).forEach((line, i) => {
			const lineNo = i + 2;
			const type = line[typeIdx]?.toLowerCase();
			const date = line[dateIdx];
			const quantity = Math.abs(parseFloat(line[qtyIdx]));

			if (type !== 'buy' && type !== 'sell' && type !== 'reinvestment') {
				skipped.push(
					`Line ${lineNo}: type "${line[typeIdx] ?? ''}" is not buy, sell or reinvestment.`
				);
			} else if (!/^\d{4}-\d{2}-\d{2}$/.test(date ?? '')) {
				skipped.push(`Line ${lineNo}: date "${date ?? ''}" is not YYYY-MM-DD.`);
			} else if (!quantity) {
				skipped.push(`Line ${lineNo}: no quantity.`);
			} else {
				rows.push({
					type,
					transactionDate: date,
					quantity,
					pricePerUnit: money(line[priceIdx]),
					brokerage: brokerageIdx === -1 ? 0 : money(line[brokerageIdx])
				});
			}
		});

		if (rows.length === 0 && skipped.length > 0) problem = 'No rows in the file could be read.';
	}

	async function onPick(event: Event) {
		const input = event.target as HTMLInputElement;
		const file = input.files?.[0];
		if (file) await readCsv(file);
		input.value = '';
	}

	async function save() {
		saving = true;
		problem = '';
		try {
			await importTransactions({
				holdingId,
				transactions: rows.map((r) => ({ ...r, platform: platform || undefined }))
			});
			open = false;
		} catch (e) {
			problem = e instanceof Error ? e.message : 'Those transactions could not be imported.';
		} finally {
			saving = false;
		}
	}

	$effect(() => {
		if (!open) {
			fileName = '';
			rows = [];
			skipped = [];
			problem = '';
			platform = '';
		}
	});
</script>

<Dialog.Root bind:open>
	<Dialog.Content class="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
		<Dialog.Header>
			<Dialog.Title>Import from CSV</Dialog.Title>
			<Dialog.Description>
				One trade per line, with headers <span class="font-mono text-xs"
					>Type, Date, Quantity, Price</span
				>
				and optionally <span class="font-mono text-xs">Brokerage</span>. Dates as YYYY-MM-DD.
			</Dialog.Description>
		</Dialog.Header>

		<button
			type="button"
			onclick={() => fileInput?.click()}
			ondragover={(e) => {
				e.preventDefault();
				dragging = true;
			}}
			ondragleave={() => (dragging = false)}
			ondrop={(e) => {
				e.preventDefault();
				dragging = false;
				const file = e.dataTransfer?.files?.[0];
				if (file) readCsv(file);
			}}
			class="flex items-center gap-3 rounded-lg border border-dashed px-3 py-3 text-left text-sm transition-colors {dragging
				? 'border-primary bg-primary/5'
				: 'text-muted-foreground hover:border-primary/50 hover:bg-muted/40'}"
		>
			<FileSpreadsheet class="size-5 shrink-0" />
			{#if fileName}
				<span class="min-w-0 flex-1 truncate font-medium text-foreground">{fileName}</span>
				<span class="text-xs">Choose another</span>
			{:else}
				<span><span class="font-medium text-foreground">Choose a CSV</span> or drop it here</span>
			{/if}
		</button>
		<input
			type="file"
			accept=".csv,text/csv"
			bind:this={fileInput}
			onchange={onPick}
			class="hidden"
		/>

		{#if problem}
			<p class="text-sm text-destructive">{problem}</p>
		{/if}

		{#if rows.length > 0}
			<div class="max-h-80 overflow-y-auto rounded-lg border">
				<Table.Root>
					<Table.Header>
						<Table.Row>
							<Table.Head>Date</Table.Head>
							<Table.Head>Type</Table.Head>
							<Table.Head class="text-right">Quantity</Table.Head>
							<Table.Head class="text-right">Price</Table.Head>
							<Table.Head class="text-right">Brokerage</Table.Head>
						</Table.Row>
					</Table.Header>
					<Table.Body>
						{#each rows as row, i (i)}
							<Table.Row>
								<Table.Cell class="tabular-nums">{row.transactionDate}</Table.Cell>
								<Table.Cell class="capitalize">{row.type}</Table.Cell>
								<Table.Cell class="text-right tabular-nums">{row.quantity}</Table.Cell>
								<Table.Cell class="text-right tabular-nums"
									>{formatCurrency(row.pricePerUnit * 100)}</Table.Cell
								>
								<Table.Cell class="text-right tabular-nums"
									>{formatCurrency(row.brokerage * 100)}</Table.Cell
								>
							</Table.Row>
						{/each}
					</Table.Body>
				</Table.Root>
			</div>
		{/if}

		{#if skipped.length > 0}
			<details class="rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-sm">
				<summary class="flex cursor-pointer items-center gap-2">
					<TriangleAlert class="size-4 text-amber-600 dark:text-amber-500" />
					{skipped.length} line{skipped.length === 1 ? '' : 's'} skipped
				</summary>
				<ul class="mt-2 space-y-0.5 text-xs text-muted-foreground">
					{#each skipped as reason, i (i)}
						<li>{reason}</li>
					{/each}
				</ul>
			</details>
		{/if}

		<div class="flex flex-wrap items-center justify-between gap-2 pt-1">
			<label class="flex items-center gap-2 text-sm text-muted-foreground">
				Platform
				<div class="w-36">
					<NativeSelect.Root bind:value={platform}>
						<NativeSelect.Option value="">Not recorded</NativeSelect.Option>
						{#each PLATFORMS as option (option)}
							<NativeSelect.Option value={option}>{option}</NativeSelect.Option>
						{/each}
					</NativeSelect.Root>
				</div>
			</label>
			<div class="flex gap-2">
				<Button variant="outline" onclick={() => (open = false)}>Cancel</Button>
				<Button onclick={save} disabled={rows.length === 0 || saving}>
					{#if saving}
						<Spinner class="size-4" />
					{/if}
					Import {rows.length || ''} transaction{rows.length === 1 ? '' : 's'}
				</Button>
			</div>
		</div>
	</Dialog.Content>
</Dialog.Root>
