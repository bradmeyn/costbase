<script lang="ts">
	import Button, { buttonVariants } from '$ui/button/button.svelte';
	import * as Dialog from '$ui/dialog/index.js';
	import * as Select from '$ui/select/index.js';
	import Input from '$ui/input/input.svelte';
	import * as Field from '$ui/field';
	import { addTransactions } from '#lib/remotes/transaction.remote.js';
	import Spinner from '$ui/spinner/spinner.svelte';
	import { Plus, Trash, Upload } from '@lucide/svelte';
	import { PLATFORMS } from '#lib/platforms.js';

	let {
		holdingId,
		open = $bindable(false),
		showTrigger = true
	}: {
		holdingId: string;
		open?: boolean;
		showTrigger?: boolean;
	} = $props();

	const TRANSACTION_TYPES = [
		{ value: 'buy', label: 'Buy' },
		{ value: 'sell', label: 'Sell' },
		{ value: 'reinvestment', label: 'Reinvestment' }
	];

	/* Each row's type is held here and submitted through the select's hidden input. */
	let transactions = $state([{ id: 0, type: '' }]);
	/*
	  One platform for the batch rather than a column per row: a sitting of manual
	  entry is a sitting with one broker's statement in front of you.
	*/
	let platform = $state('');
	let fileInput: HTMLInputElement;
	let isDragging = $state(false);

	function addMore() {
		transactions = [...transactions, { id: transactions.length, type: '' }];
	}

	function removeAt(index: number) {
		if (transactions.length <= 1) return;
		transactions = transactions.filter((_, i) => i !== index);
	}

	function parseCSV(text: string): string[][] {
		const lines = text.trim().split('\n');
		return lines.map((line) => {
			const values: string[] = [];
			let current = '';
			let inQuotes = false;

			for (let i = 0; i < line.length; i++) {
				const char = line[i];
				if (char === '"') {
					inQuotes = !inQuotes;
				} else if (char === ',' && !inQuotes) {
					values.push(current.trim());
					current = '';
				} else {
					current += char;
				}
			}
			values.push(current.trim());
			return values;
		});
	}

	async function processCSVFile(file: File) {
		if (!file.name.endsWith('.csv')) return;

		const text = await file.text();
		const rows = parseCSV(text);

		if (rows.length < 2) return;

		// Get header row and find column indices (case-insensitive)
		const headers = rows[0].map((h) => h.toLowerCase().trim());
		const typeIdx = headers.findIndex((h) => h.includes('type'));
		const dateIdx = headers.findIndex((h) => h.includes('date'));
		const qtyIdx = headers.findIndex((h) => h.includes('qty') || h.includes('quantity'));
		const priceIdx = headers.findIndex((h) => h.includes('price'));
		const brokerageIdx = headers.findIndex((h) => h.includes('brokerage'));

		// Check if we have the minimum required columns
		if (typeIdx === -1 || dateIdx === -1 || qtyIdx === -1 || priceIdx === -1) {
			console.error('Missing required columns in CSV');
			return;
		}

		// Reset transactions
		transactions = [];

		// Parse data rows
		const dataRows = rows.slice(1);
		dataRows.forEach((row, index) => {
			if (row.length > Math.max(typeIdx, dateIdx, qtyIdx, priceIdx)) {
				const quantity = Math.abs(parseFloat(row[qtyIdx])) || 0;

				// Skip if quantity is 0
				if (quantity === 0) return;

				transactions.push({ id: index, type: '' });

				// Set form values
				const type = row[typeIdx].toLowerCase().trim();
				if (type === 'buy' || type === 'sell' || type === 'reinvestment') {
					addTransactions.fields.transactions[transactions.length - 1].type.set(type);
				}
				addTransactions.fields.transactions[transactions.length - 1].quantity.set(quantity);
				addTransactions.fields.transactions[transactions.length - 1].pricePerUnit.set(
					Math.round((parseFloat(row[priceIdx]) || 0) * 100) / 100
				);
				addTransactions.fields.transactions[transactions.length - 1].brokerage.set(
					brokerageIdx !== -1 ? Math.round((parseFloat(row[brokerageIdx]) || 0) * 100) / 100 : 0
				);

				// Parse date (format: YYYY-MM-DD)
				const dateStr = row[dateIdx]?.trim();
				if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
					addTransactions.fields.transactions[transactions.length - 1].transactionDate.set(dateStr);
				}
			}
		});
	}

	async function handleCSVUpload(event: Event) {
		const input = event.target as HTMLInputElement;
		const file = input.files?.[0];
		if (!file) return;

		await processCSVFile(file);

		// Clear file input
		input.value = '';
	}

	function handleDragOver(event: DragEvent) {
		event.preventDefault();
		isDragging = true;
	}

	function handleDragLeave(event: DragEvent) {
		event.preventDefault();
		isDragging = false;
	}

	async function handleDrop(event: DragEvent) {
		event.preventDefault();
		isDragging = false;

		const file = event.dataTransfer?.files?.[0];
		if (file) {
			await processCSVFile(file);
		}
	}

	function resetForm() {
		platform = '';
		transactions = [{ id: 0, type: '' }];
	}

	$effect(() => {
		if (!open) {
			resetForm();
		}
	});
</script>

<Dialog.Root bind:open>
	{#if showTrigger}
		<Dialog.Trigger class={buttonVariants({ variant: 'default' })}>Add Transactions</Dialog.Trigger>
	{/if}

	<Dialog.Content class="max-h-[90vh] min-w-2xl overflow-y-auto md:min-w-3xl">
		<Dialog.Header>
			<Dialog.Title>Add Transactions</Dialog.Title>
			<Dialog.Description>Add one or more transactions for this holding.</Dialog.Description>
		</Dialog.Header>

		<div
			role="button"
			tabindex="0"
			class="mb-4 rounded-lg border-2 border-dashed p-4 transition-colors {isDragging
				? 'border-primary bg-primary/5'
				: 'border-muted-foreground/25'}"
			ondragover={handleDragOver}
			ondragleave={handleDragLeave}
			ondrop={handleDrop}
			onclick={() => fileInput.click()}
			onkeydown={(e) => e.key === 'Enter' && fileInput.click()}
		>
			<input
				type="file"
				accept=".csv"
				bind:this={fileInput}
				onchange={handleCSVUpload}
				class="hidden"
			/>
			<div class="flex flex-col items-center gap-2 text-center">
				<Upload class="size-8 text-muted-foreground" />
				<div>
					<p class="text-sm font-medium">
						Drop CSV file here or
						<button
							type="button"
							onclick={() => fileInput.click()}
							class="text-primary underline-offset-4 hover:underline"
						>
							browse
						</button>
					</p>
					<p class="mt-1 text-xs text-muted-foreground">
						CSV with headers: Type, Date, Quantity/Qty, Price, Brokerage (optional)
					</p>
				</div>
			</div>
		</div>

		{#each addTransactions.fields.allIssues?.() ?? [] as issue, i (i)}
			<p class="text-sm text-destructive">{issue.message}</p>
		{/each}

		<form
			{...addTransactions.enhance(async (form) => {
				try {
					for (let i = 0; i < transactions.length; i++) {
						addTransactions.fields.transactions[i].platform.set(platform.trim() || undefined);
					}
					await form.submit();
					if (form.result?.success) {
						form.element.reset();
						resetForm();
						open = false;
					}
				} catch (e) {
					console.error('Error adding transactions', e);
				}
			})}
			class="space-y-3"
		>
			<Field.Field>
				<Field.Label for="platform">Platform</Field.Label>
				<Select.Root type="single" bind:value={platform} disabled={!!addTransactions.pending}>
					<Select.Trigger id="platform" class="w-full">
						{platform || 'Not recorded'}
					</Select.Trigger>
					<Select.Content>
						<Select.Item value="">Not recorded</Select.Item>
						{#each PLATFORMS as option (option)}
							<Select.Item value={option}>{option}</Select.Item>
						{/each}
					</Select.Content>
				</Select.Root>
				<p class="text-[11px] text-muted-foreground">
					Optional. Which broker these went through — applied to every row below.
				</p>
			</Field.Field>

			<div class="mb-2 rounded-lg bg-muted/30 p-3">
				<div class="flex items-center gap-3">
					<div class="flex-1 text-sm font-medium text-muted-foreground">Type</div>
					<div class="flex-1 text-sm font-medium text-muted-foreground">Quantity</div>
					<div class="flex-1 text-sm font-medium text-muted-foreground">Price</div>
					<div class="flex-1 text-sm font-medium text-muted-foreground">Brokerage</div>
					<div class="flex-[1.5] text-sm font-medium text-muted-foreground">Date</div>
					<div class="w-9"></div>
				</div>
			</div>

			<div class="space-y-2">
				{#each transactions as transaction, i (transaction.id)}
					<div class="rounded-lg border bg-card p-3 transition-shadow hover:shadow-sm">
						<div class="flex items-center gap-3">
							<Field.Field class="flex-1">
								<Select.Root
									type="single"
									name={addTransactions.fields.transactions[i].type.as('text').name}
									bind:value={transactions[i].type}
									disabled={!!addTransactions.pending}
								>
									<Select.Trigger class="w-full">
										{TRANSACTION_TYPES.find((t) => t.value === transactions[i].type)?.label ??
											'Type'}
									</Select.Trigger>
									<Select.Content>
										{#each TRANSACTION_TYPES as option (option.value)}
											<Select.Item value={option.value}>{option.label}</Select.Item>
										{/each}
									</Select.Content>
								</Select.Root>
								<Field.Error />
							</Field.Field>

							<Field.Field class="flex-1">
								<Input
									{...addTransactions.fields.transactions[i].quantity.as('number')}
									placeholder="Quantity"
									min="1"
									step="1"
									disabled={!!addTransactions.pending}
									class="text-sm"
								/>
								<Field.Error />
							</Field.Field>

							<Field.Field class="flex-1">
								<Input
									{...addTransactions.fields.transactions[i].pricePerUnit.as('number')}
									placeholder="Price"
									min="0"
									step="0.01"
									disabled={!!addTransactions.pending}
									class="text-sm"
								/>
								<Field.Error />
							</Field.Field>

							<Field.Field class="flex-1">
								<Input
									{...addTransactions.fields.transactions[i].brokerage.as('number')}
									placeholder="Brokerage"
									min="0"
									step="0.01"
									disabled={!!addTransactions.pending}
									class="text-sm"
								/>
								<Field.Error />
							</Field.Field>

							<Field.Field class="flex-[1.5]">
								<Input
									{...addTransactions.fields.transactions[i].transactionDate.as('date')}
									disabled={!!addTransactions.pending}
									class="text-sm"
								/>
								<Field.Error />
							</Field.Field>

							<Button
								size="icon"
								onclick={() => removeAt(i)}
								disabled={!!addTransactions.pending || transactions.length <= 1}
								variant="ghost"
								class="shrink-0"
							>
								<Trash class="size-4" />
							</Button>
						</div>
					</div>
				{/each}
			</div>

			<Button
				size="sm"
				onclick={addMore}
				disabled={!!addTransactions.pending}
				variant="outline"
				class="mt-2 gap-2"
			>
				<Plus class="size-4" />
				Add Another
			</Button>

			<input type="hidden" {...addTransactions.fields.holdingId.as('text')} value={holdingId} />

			<div class="mt-6 flex justify-end gap-2">
				<Button type="button" variant="outline" onclick={() => (open = false)}>Cancel</Button>
				<Button type="submit" disabled={!!addTransactions.pending}>
					{#if addTransactions.pending}
						<Spinner class="size-4" />
					{:else}
						Add {transactions.length} Transaction{transactions.length > 1 ? 's' : ''}
					{/if}
				</Button>
			</div>
		</form>
	</Dialog.Content>
</Dialog.Root>
