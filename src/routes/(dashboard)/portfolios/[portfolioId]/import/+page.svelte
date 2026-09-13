<script lang="ts">
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import Button from '$ui/button/button.svelte';
	import Input from '$ui/input/input.svelte';
	import Label from '$ui/label/label.svelte';
	import * as NativeSelect from '$ui/native-select';
	import { ArrowLeft, TriangleAlert, FileText } from '@lucide/svelte';
	import { getPortfolio } from '#lib/remotes/portfolio.remote.js';
	import { previewContractNote, importContractNote } from '#lib/remotes/import.remote.js';
	import { formatCurrency } from '#lib/utils/formatters.js';

	const portfolioId = $derived(page.params.portfolioId!);
	const portfolio = $derived(await getPortfolio(portfolioId));

	/** Held client-side so the confirmed step can re-send the same file. */
	let file = $state<File | null>(null);
	let preview = $state<Awaited<ReturnType<typeof previewContractNote>> | null>(null);

	const parsed = $derived(preview?.parsed ?? null);
	/** Where to land after saving; the user may override the matched holding. */
	let confirmedHoldingId = $state('');
	$effect(() => {
		if (preview?.holdingId) confirmedHoldingId = preview.holdingId;
	});
	const dollars = (cents: number | null | undefined) =>
		cents === null || cents === undefined ? '' : (cents / 100).toFixed(2);

	async function onFile(event: Event) {
		const input = event.currentTarget as HTMLInputElement;
		const picked = input.files?.[0] ?? null;
		file = picked;
		preview = null;
		if (!picked) return;

		preview = await previewContractNote({ portfolioId, file: picked });
	}
</script>

<svelte:head><title>Import contract note | Costbase</title></svelte:head>

<div class="mb-4">
	<a
		href={resolve('/(dashboard)/portfolios/[portfolioId]/(tabs)', { portfolioId })}
		class="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
	>
		<ArrowLeft class="size-4" /> Back to portfolio
	</a>
</div>

<div class="mb-5">
	<h1 class="text-2xl font-semibold tracking-tight">Import contract note</h1>
	<p class="mt-1 text-[13px] text-muted-foreground">
		Upload a broker confirmation. Nothing is saved until you check the figures below.
	</p>
</div>

<form
	{...importContractNote.enhance(async ({ submit }) => {
		await submit();
		if (importContractNote.result?.success) {
			await goto(
				resolve('/(dashboard)/portfolios/[portfolioId]/[holdingId]/(tabs)', {
					portfolioId,
					holdingId: confirmedHoldingId
				})
			);
		}
	})}
>
	<input type="hidden" name="portfolioId" value={portfolioId} />

	<div class="card mb-5">
		<Label for="note">Contract note (PDF)</Label>
		<input
			id="note"
			name="file"
			type="file"
			accept="application/pdf"
			onchange={onFile}
			class="block w-full text-[13px] text-muted-foreground file:mr-3 file:rounded-md file:border file:border-border file:bg-secondary file:px-3 file:py-1.5 file:text-[13px] file:text-foreground hover:file:bg-accent"
		/>
		{#if file && !preview}
			<p class="mt-3 text-[13px] text-muted-foreground">Reading {file.name}…</p>
		{/if}
	</div>

	{#if preview && parsed}
		{#if parsed.warnings.length > 0}
			<div class="mb-5 rounded-md border border-brand-2/40 bg-brand-2/10 p-4">
				<p class="flex items-center gap-2 text-sm font-medium text-brand-2">
					<TriangleAlert class="size-4" /> Check these before saving
				</p>
				<ul class="mt-2 space-y-1">
					{#each parsed.warnings as warning, i (i)}
						<li class="text-[13px] text-muted-foreground">{warning}</li>
					{/each}
				</ul>
			</div>
		{/if}

		<div class="card space-y-4">
			<input type="hidden" name="confirmationNumber" value={parsed.confirmationNumber ?? ''} />

			<div class="flex items-center gap-2 border-b border-border pb-3">
				<FileText class="size-4 text-muted-foreground" />
				<p class="text-sm font-semibold">Confirm the details</p>
				{#if parsed.confirmationNumber}
					<span class="ml-auto text-[11px] text-muted-foreground tabular-nums">
						Confirmation {parsed.confirmationNumber}
					</span>
				{/if}
			</div>

			<div class="grid gap-4 sm:grid-cols-2">
				<div>
					<Label for="holdingId">Holding</Label>
					<NativeSelect.Root id="holdingId" name="holdingId" bind:value={confirmedHoldingId}>
						<NativeSelect.Option value="">Select a holding</NativeSelect.Option>
						{#each portfolio.holdings as h (h.id)}
							<NativeSelect.Option value={h.id}>
								{h.investment.code} — {h.investment.name}
							</NativeSelect.Option>
						{/each}
					</NativeSelect.Root>
				</div>

				<div>
					<Label for="type">Type</Label>
					<NativeSelect.Root id="type" name="type" value={parsed.side ?? ''}>
						<NativeSelect.Option value="">Select type</NativeSelect.Option>
						<NativeSelect.Option value="buy">Buy</NativeSelect.Option>
						<NativeSelect.Option value="sell">Sell</NativeSelect.Option>
						<NativeSelect.Option value="reinvestment">Reinvestment</NativeSelect.Option>
					</NativeSelect.Root>
				</div>

				<div>
					<Label for="transactionDate">Execution date</Label>
					<Input
						id="transactionDate"
						name="transactionDate"
						type="date"
						defaultValue={parsed.executionDate ?? ''}
					/>
				</div>

				<div>
					<Label for="quantity">Quantity</Label>
					<Input
						id="quantity"
						{...importContractNote.fields.quantity.as('number')}
						defaultValue={parsed.quantity ?? ''}
						class="tabular-nums"
					/>
				</div>

				<div>
					<Label for="pricePerUnit">Price per unit</Label>
					<Input
						id="pricePerUnit"
						{...importContractNote.fields.pricePerUnit.as('number')}
						step="0.01"
						defaultValue={dollars(parsed.pricePerUnit)}
						class="tabular-nums"
					/>
				</div>

				<div>
					<Label for="value">Total value</Label>
					<Input
						id="value"
						{...importContractNote.fields.value.as('number')}
						step="0.01"
						defaultValue={dollars(parsed.value)}
						class="tabular-nums"
					/>
					<p class="mt-1 text-[11px] text-muted-foreground">
						As stated on the note. Used for the cost base in preference to quantity × price.
					</p>
				</div>

				<div>
					<Label for="brokerage">Brokerage &amp; GST</Label>
					<Input
						id="brokerage"
						{...importContractNote.fields.brokerage.as('number')}
						step="0.01"
						defaultValue={dollars(parsed.brokerage)}
						class="tabular-nums"
					/>
				</div>

				{#if parsed.netAmount !== null}
					<div>
						<Label for="net">Net {parsed.side === 'buy' ? 'cost' : 'proceeds'}</Label>
						<p id="net" class="mt-1 text-sm tabular-nums">{formatCurrency(parsed.netAmount)}</p>
						<p class="mt-1 text-[11px] text-muted-foreground">From the note, for checking only.</p>
					</div>
				{/if}
			</div>

			{#each importContractNote.fields.allIssues?.() ?? [] as issue, i (i)}
				<p class="text-[13px] text-destructive">{issue.message}</p>
			{/each}

			<div class="flex items-center justify-end gap-2 border-t border-border pt-4">
				<Button
					variant="ghost"
					href={resolve('/(dashboard)/portfolios/[portfolioId]/(tabs)', { portfolioId })}
				>
					Cancel
				</Button>
				<Button type="submit" disabled={!!importContractNote.pending || preview.duplicate}>
					{importContractNote.pending ? 'Saving…' : 'Save transaction'}
				</Button>
			</div>
		</div>
	{/if}
</form>
