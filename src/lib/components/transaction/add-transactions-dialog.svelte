<script lang="ts">
	import Button, { buttonVariants } from '#lib/components/ui/button/button.svelte';
	import * as Dialog from '#lib/components/ui/dialog/index.js';
	import * as NativeSelect from '#lib/components/ui/native-select/index.js';
	import Input from '#lib/components/ui/input/input.svelte';
	import { addTransactions, readContractNote } from '#lib/remotes/transaction.remote.js';
	import Spinner from '#lib/components/ui/spinner/spinner.svelte';
	import { FileText, FileUp, Plus, TriangleAlert, X } from '@lucide/svelte';
	import { PLATFORMS } from '#lib/platforms.js';
	import { untrack } from 'svelte';

	let {
		holdingId,
		open = $bindable(false),
		showTrigger = true
	}: {
		holdingId: string;
		open?: boolean;
		showTrigger?: boolean;
	} = $props();

	/** A contract note a row was filled from, filed against the trade when it is saved. */
	interface Note {
		file: File;
		confirmationNumber: string | null;
		/** Stated consideration in cents. */
		value: number | null;
		warnings: string[];
	}

	/*
	  The figures live in the form's fields, indexed by position. This list only keeps
	  each row's identity and the note behind it, and is kept in step with the fields.
	*/
	let rows = $state<{ id: number; note?: Note }[]>([{ id: 0 }]);
	let nextId = 1;

	let fileInput = $state<HTMLInputElement>();
	let reading = $state(false);
	/** Files that could not become a row, and why. */
	let rejected = $state<string[]>([]);
	/** A save that failed outright, as opposed to a field that did not validate. */
	let saveError = $state('');
	// Counted rather than flagged: dragging over a child fires leave on the parent.
	let dragDepth = $state(0);

	const fields = addTransactions.fields;

	function addRow() {
		// A sitting of manual entry is usually one broker's statements, so carry it on.
		const previous = fields.transactions[rows.length - 1]?.platform.value();
		rows.push({ id: nextId++ });
		if (previous) fields.transactions[rows.length - 1].platform.set(previous);
	}

	function removeAt(index: number) {
		if (rows.length <= 1) return;
		const values = [...(fields.transactions.value() ?? [])];
		values.splice(index, 1);
		fields.transactions.set(values);
		rows.splice(index, 1);
	}

	/** Whether the dialog still holds only the blank row it opened with. */
	function isUntouched() {
		const first = fields.transactions.value()?.[0];
		return (
			rows.length === 1 &&
			!rows[0].note &&
			!first?.quantity &&
			!first?.pricePerUnit &&
			!first?.transactionDate
		);
	}

	/*
	  Each note is read on the server and becomes one row. Nothing is saved yet: the
	  figures sit in the form to be checked, the same as a row typed by hand.
	*/
	async function readNotes(files: File[]) {
		const pdfs = files.filter((f) => f.type === 'application/pdf' || /\.pdf$/i.test(f.name));
		rejected = files.filter((f) => !pdfs.includes(f)).map((f) => `${f.name} is not a PDF.`);
		if (pdfs.length === 0) return;

		reading = true;
		try {
			const results = await Promise.all(
				pdfs.map(async (file) => {
					try {
						return { file, result: await readContractNote({ holdingId, file }) };
					} catch {
						return {
							file,
							result: { ok: false as const, reason: `${file.name} could not be read.` }
						};
					}
				})
			);

			const notes = results.flatMap(({ file, result }) => {
				if (!result.ok) {
					rejected.push(result.reason);
					return [];
				}
				return [{ file, parsed: result.parsed }];
			});
			if (notes.length === 0) return;

			// Oldest first, as the trades happened.
			notes.sort((a, b) =>
				(a.parsed.executionDate ?? '').localeCompare(b.parsed.executionDate ?? '')
			);

			const start = isUntouched() ? 0 : rows.length;
			const values = [...(fields.transactions.value() ?? [])].slice(0, start);
			rows = rows.slice(0, start);

			for (const { file, parsed } of notes) {
				// The note's value over its quantity is truer than its rounded unit price.
				const cents =
					parsed.value !== null && parsed.quantity
						? parsed.value / parsed.quantity
						: (parsed.pricePerUnit ?? 0);
				values.push({
					transactionDate: parsed.executionDate ?? '',
					type: parsed.side ?? undefined,
					quantity: parsed.quantity ?? undefined,
					pricePerUnit: Math.round(cents) / 100,
					brokerage: (parsed.brokerage ?? 0) / 100,
					platform: parsed.platform ?? ''
				} as (typeof values)[number]);
				rows.push({
					id: nextId++,
					note: {
						file,
						confirmationNumber: parsed.confirmationNumber,
						value: parsed.value,
						warnings: parsed.warnings
					}
				});
			}
			fields.transactions.set(values);
		} finally {
			reading = false;
		}
	}

	function onDrop(event: DragEvent) {
		event.preventDefault();
		dragDepth = 0;
		readNotes([...(event.dataTransfer?.files ?? [])]);
	}

	async function onPick(event: Event) {
		const input = event.target as HTMLInputElement;
		await readNotes([...(input.files ?? [])]);
		input.value = '';
	}

	/** Hands the row's note to a file input so it is submitted with the form. */
	function carries(file: File) {
		return (input: HTMLInputElement) => {
			const transfer = new DataTransfer();
			transfer.items.add(file);
			input.files = transfer.files;
		};
	}

	function reset() {
		rows = [{ id: nextId++ }];
		rejected = [];
		saveError = '';
		dragDepth = 0;
		fields.transactions.set([]);
	}

	$effect(() => {
		// Only `open` drives this: resetting reads the form state it then writes.
		if (!open) untrack(reset);
	});

	const COLUMNS =
		'md:grid-cols-[9.5rem_7.5rem_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_8rem_2rem]';
</script>

<Dialog.Root bind:open>
	{#if showTrigger}
		<Dialog.Trigger class={buttonVariants({ variant: 'default' })}>Add transactions</Dialog.Trigger>
	{/if}

	<Dialog.Content
		class="max-h-[90vh] overflow-y-auto sm:max-w-4xl"
		ondragenter={(e: DragEvent) => {
			e.preventDefault();
			dragDepth += 1;
		}}
		ondragover={(e: DragEvent) => e.preventDefault()}
		ondragleave={() => (dragDepth = Math.max(0, dragDepth - 1))}
		ondrop={onDrop}
	>
		{#if dragDepth > 0}
			<div
				class="pointer-events-none absolute inset-2 z-10 flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-primary bg-popover/95"
			>
				<FileUp class="size-8 text-primary" />
				<p class="text-sm font-medium">Drop contract notes to fill in rows</p>
			</div>
		{/if}

		<Dialog.Header>
			<Dialog.Title>Add transactions</Dialog.Title>
			<Dialog.Description>
				Type trades in, or drop contract notes anywhere here to fill them in. Notes are filed
				against the trades they came from.
			</Dialog.Description>
		</Dialog.Header>

		<button
			type="button"
			onclick={() => fileInput?.click()}
			disabled={reading}
			class="flex items-center gap-3 rounded-lg border border-dashed px-3 py-2.5 text-left text-sm text-muted-foreground transition-colors hover:border-primary/50 hover:bg-muted/40 disabled:opacity-60"
		>
			{#if reading}
				<Spinner class="size-4" />
				<span>Reading notes…</span>
			{:else}
				<FileUp class="size-4 shrink-0" />
				<span>
					<span class="font-medium text-foreground">Choose contract notes</span> or drop PDFs here
					<span class="hidden sm:inline">— Stake and SelfWealth</span>
				</span>
			{/if}
		</button>
		<input
			type="file"
			accept=".pdf,application/pdf"
			multiple
			bind:this={fileInput}
			onchange={onPick}
			class="hidden"
		/>

		{#if rejected.length > 0}
			<div
				class="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-sm"
			>
				<TriangleAlert class="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-500" />
				<ul class="flex-1 space-y-0.5">
					{#each rejected as reason, i (i)}
						<li>{reason}</li>
					{/each}
				</ul>
				<button
					type="button"
					class="text-muted-foreground hover:text-foreground"
					onclick={() => (rejected = [])}
					aria-label="Dismiss"
				>
					<X class="size-4" />
				</button>
			</div>
		{/if}

		<form
			{...addTransactions.enhance(async (form) => {
				saveError = '';
				try {
					await form.submit();
					if (form.result?.success) open = false;
				} catch (e) {
					saveError = e instanceof Error ? e.message : 'Those transactions could not be saved.';
				}
			})}
			enctype="multipart/form-data"
			class="space-y-3"
		>
			<input {...fields.holdingId.as('hidden', holdingId)} />

			{#if saveError}
				<p class="text-sm text-destructive">{saveError}</p>
			{/if}
			{#each fields.allIssues?.() ?? [] as issue, i (i)}
				<p class="text-sm text-destructive">{issue.message}</p>
			{/each}

			<div class="rounded-lg border">
				<div
					class="hidden gap-2 border-b bg-muted/40 px-3 py-2 text-xs font-medium text-muted-foreground md:grid {COLUMNS}"
				>
					<span>Date</span>
					<span>Type</span>
					<span class="text-right">Quantity</span>
					<span class="text-right">Price</span>
					<span class="text-right">Brokerage</span>
					<span>Platform</span>
					<span></span>
				</div>

				{#each rows as row, i (row.id)}
					{@const f = fields.transactions[i]}
					<div class="border-b px-3 py-2.5 last:border-b-0">
						<div class="grid grid-cols-2 gap-2 {COLUMNS}">
							<Input {...f.transactionDate.as('date')} aria-label="Date" />
							<NativeSelect.Root {...f.type.as('select')} aria-label="Type">
								<NativeSelect.Option value="">Type</NativeSelect.Option>
								<NativeSelect.Option value="buy">Buy</NativeSelect.Option>
								<NativeSelect.Option value="sell">Sell</NativeSelect.Option>
								<NativeSelect.Option value="reinvestment">Reinvestment</NativeSelect.Option>
							</NativeSelect.Root>
							<Input
								{...f.quantity.as('number')}
								aria-label="Quantity"
								placeholder="Qty"
								min="1"
								step="1"
								class="text-right tabular-nums"
							/>
							<Input
								{...f.pricePerUnit.as('number')}
								aria-label="Price per unit"
								placeholder="0.00"
								min="0"
								step="0.01"
								class="text-right tabular-nums"
							/>
							<Input
								{...f.brokerage.as('number')}
								aria-label="Brokerage"
								placeholder="0.00"
								min="0"
								step="0.01"
								class="text-right tabular-nums"
							/>
							<NativeSelect.Root {...f.platform.as('select')} aria-label="Platform">
								<NativeSelect.Option value="">—</NativeSelect.Option>
								{#each PLATFORMS as option (option)}
									<NativeSelect.Option value={option}>{option}</NativeSelect.Option>
								{/each}
							</NativeSelect.Root>
							<Button
								size="icon"
								variant="ghost"
								onclick={() => removeAt(i)}
								disabled={rows.length <= 1}
								aria-label="Remove row"
								class="justify-self-end text-muted-foreground"
							>
								<X class="size-4" />
							</Button>
						</div>

						{#each f.allIssues?.() ?? [] as issue, j (j)}
							<p class="mt-1.5 text-xs text-destructive">{issue.message}</p>
						{/each}

						{#if row.note}
							<!-- Named only: the field's own `files` binding would clear what is attached. -->
							<input
								type="file"
								name={f.note.as('file').name}
								class="hidden"
								{@attach carries(row.note.file)}
							/>
							{#if row.note.confirmationNumber}
								<input {...f.confirmationNumber.as('hidden', row.note.confirmationNumber)} />
							{/if}
							{#if row.note.value !== null}
								<input {...f.value.as('hidden', row.note.value)} />
							{/if}

							<div class="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
								<span class="inline-flex min-w-0 items-center gap-1.5 text-muted-foreground">
									<FileText class="size-3.5 shrink-0" />
									<span class="truncate">{row.note.file.name}</span>
								</span>
								{#each row.note.warnings as warning, j (j)}
									<span class="inline-flex items-center gap-1 text-amber-600 dark:text-amber-500">
										<TriangleAlert class="size-3.5 shrink-0" />
										{warning}
									</span>
								{/each}
							</div>
						{/if}
					</div>
				{/each}
			</div>

			<div class="flex items-center justify-between gap-2 pt-1">
				<Button size="sm" variant="ghost" onclick={addRow} class="gap-1.5">
					<Plus class="size-4" />
					Add row
				</Button>
				<div class="flex gap-2">
					<Button type="button" variant="outline" onclick={() => (open = false)}>Cancel</Button>
					<Button type="submit" disabled={!!addTransactions.pending || reading}>
						{#if addTransactions.pending}
							<Spinner class="size-4" />
						{/if}
						Add {rows.length} transaction{rows.length === 1 ? '' : 's'}
					</Button>
				</div>
			</div>
		</form>
	</Dialog.Content>
</Dialog.Root>
