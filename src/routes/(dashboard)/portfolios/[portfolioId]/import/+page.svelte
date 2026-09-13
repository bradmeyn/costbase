<script lang="ts">
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import Button from '$ui/button/button.svelte';
	import Input from '$ui/input/input.svelte';
	import Label from '$ui/label/label.svelte';
	import Checkbox from '$ui/checkbox/checkbox.svelte';
	import * as Table from '$ui/table';
	import * as NativeSelect from '$ui/native-select';
	import { ArrowLeft, TriangleAlert, FileText, Coins } from '@lucide/svelte';
	import { getPortfolio } from '#lib/remotes/portfolio.remote.js';
	import {
		previewImport,
		importContractNote,
		importDistributionStatement
	} from '#lib/remotes/import.remote.js';
	import { formatCurrency } from '#lib/utils.js';

	const portfolioId = $derived(page.params.portfolioId!);
	const portfolio = $derived(await getPortfolio(portfolioId));

	/** Held client-side so the confirmed step can re-send the same file. */
	let file = $state<File | null>(null);
	let preview = $state<Awaited<ReturnType<typeof previewImport>> | null>(null);
	let reading = $state(false);
	let saveError = $state('');

	const note = $derived(preview?.kind === 'contract-note' ? preview : null);
	const statement = $derived(preview?.kind === 'distribution-statement' ? preview : null);

	/* The confirmed trade, edited in dollars and only written on submit. */
	type NoteEdit = {
		holdingId: string;
		type: string;
		transactionDate: string;
		quantity: number;
		pricePerUnit: string;
		value: string;
		brokerage: string;
	};
	let noteEdit = $state<NoteEdit | null>(null);
	let saving = $state(false);

	$effect(() => {
		if (!note) return;
		noteEdit = {
			holdingId: note.holdingId ?? '',
			type: note.parsed.side ?? '',
			transactionDate: note.parsed.executionDate ?? '',
			quantity: note.parsed.quantity ?? 0,
			pricePerUnit: dollars(note.parsed.pricePerUnit),
			value: dollars(note.parsed.value),
			brokerage: dollars(note.parsed.brokerage)
		};
	});

	/* Confirmed distribution rows, keyed by ticker and edited in dollars. */
	type RowEdit = {
		include: boolean;
		units: number;
		gross: string;
		tax: string;
		reinvested: boolean;
	};
	let rowEdits = $state<Record<string, RowEdit>>({});
	let paymentDate = $state('');
	let recordDate = $state('');

	$effect(() => {
		if (!statement) return;
		paymentDate = statement.statement.paymentDate ?? '';
		recordDate = statement.statement.recordDate ?? '';
		rowEdits = Object.fromEntries(
			statement.rows.map((row) => [
				row.ticker,
				{
					include: !!row.holdingId && !row.duplicate,
					units: row.units ?? 0,
					gross: dollars(row.grossPayment),
					tax: dollars(row.taxWithheld),
					reinvested: false
				}
			])
		);
	});

	const dollars = (cents: number | null | undefined) =>
		cents === null || cents === undefined ? '' : (cents / 100).toFixed(2);
	const toCents = (value: string) => Math.round((parseFloat(value) || 0) * 100);
	/** Millionths of a cent back to the eight-decimal rate the statement prints. */
	const rate = (millionths: number | null) =>
		millionths === null ? '—' : `$${(millionths / 1e8).toFixed(8)}`;

	const chosenRows = $derived(
		(statement?.rows ?? []).filter((row) => row.holdingId && rowEdits[row.ticker]?.include)
	);
	const chosenTotal = $derived(
		chosenRows.reduce((sum, row) => sum + toCents(rowEdits[row.ticker]?.gross ?? '0'), 0)
	);

	async function onFile(event: Event) {
		const input = event.currentTarget as HTMLInputElement;
		const picked = input.files?.[0] ?? null;
		file = picked;
		preview = null;
		saveError = '';
		if (!picked) return;

		reading = true;
		try {
			preview = await previewImport({ portfolioId, file: picked });
		} finally {
			reading = false;
		}
	}

	async function saveTrade() {
		if (!file || !noteEdit) return;
		saveError = '';
		saving = true;
		try {
			await importContractNote({
				portfolioId,
				file,
				holdingId: noteEdit.holdingId,
				type: noteEdit.type as 'buy' | 'sell' | 'reinvestment',
				quantity: noteEdit.quantity,
				pricePerUnit: toCents(noteEdit.pricePerUnit),
				value: toCents(noteEdit.value),
				brokerage: toCents(noteEdit.brokerage),
				transactionDate: noteEdit.transactionDate,
				confirmationNumber: note?.parsed.confirmationNumber ?? undefined
			});
			await goto(
				resolve('/(dashboard)/portfolios/[portfolioId]/[holdingId]/(tabs)', {
					portfolioId,
					holdingId: noteEdit.holdingId
				})
			);
		} catch (e) {
			saveError = e instanceof Error ? e.message : 'That trade could not be saved.';
		} finally {
			saving = false;
		}
	}

	async function saveDistributions() {
		if (!file || chosenRows.length === 0) return;
		saveError = '';
		try {
			await importDistributionStatement({
				portfolioId,
				file,
				paymentDate,
				recordDate: recordDate || undefined,
				rows: chosenRows.map((row) => ({
					holdingId: row.holdingId!,
					units: rowEdits[row.ticker].units,
					centsPerUnit: row.centsPerUnit ?? 0,
					grossPayment: toCents(rowEdits[row.ticker].gross),
					taxWithheld: toCents(rowEdits[row.ticker].tax),
					reinvested: rowEdits[row.ticker].reinvested
				}))
			});
			await goto(resolve('/(dashboard)/portfolios/[portfolioId]/(tabs)', { portfolioId }));
		} catch (e) {
			saveError = e instanceof Error ? e.message : 'Those distributions could not be saved.';
		}
	}
</script>

<svelte:head><title>Import a document | Costbase</title></svelte:head>

<div class="mb-4">
	<a
		href={resolve('/(dashboard)/portfolios/[portfolioId]/(tabs)', { portfolioId })}
		class="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
	>
		<ArrowLeft class="size-4" /> Back to portfolio
	</a>
</div>

<div class="mb-5">
	<h1 class="text-2xl font-semibold tracking-tight">Import a document</h1>
	<p class="mt-1 text-[13px] text-muted-foreground">
		A broker contract note or a distribution statement. Nothing is saved until you check the
		figures.
	</p>
</div>

<div class="card mb-5">
	<Label for="document">PDF</Label>
	<input
		id="document"
		type="file"
		accept="application/pdf"
		onchange={onFile}
		class="block w-full text-[13px] text-muted-foreground file:mr-3 file:rounded-md file:border file:border-border file:bg-secondary file:px-3 file:py-1.5 file:text-[13px] file:text-foreground hover:file:bg-accent"
	/>
	{#if reading && file}
		<p class="mt-3 text-[13px] text-muted-foreground">Reading {file.name}…</p>
	{/if}
</div>

{#if preview?.kind === 'unknown'}
	<div class="card py-8 text-center text-[13px] text-muted-foreground">
		This does not look like a contract note or a distribution statement. Enter it by hand instead.
	</div>
{/if}

{#snippet warningPanel(items: string[])}
	<div class="mb-5 rounded-md border border-brand-2/40 bg-brand-2/10 p-4">
		<p class="flex items-center gap-2 text-sm font-medium text-brand-2">
			<TriangleAlert class="size-4" /> Check these before saving
		</p>
		<ul class="mt-2 space-y-1">
			{#each items as item, i (i)}
				<li class="text-[13px] text-muted-foreground">{item}</li>
			{/each}
		</ul>
	</div>
{/snippet}

{#if note && noteEdit}
	{#if note.parsed.warnings.length > 0}
		{@render warningPanel(note.parsed.warnings)}
	{/if}

	<div class="card space-y-4">
		<div class="flex items-center gap-2 border-b border-border pb-3">
			<FileText class="size-4 text-muted-foreground" />
			<p class="text-sm font-semibold">Confirm the trade</p>
			{#if note.parsed.confirmationNumber}
				<span class="ml-auto text-[11px] text-muted-foreground tabular-nums">
					Confirmation {note.parsed.confirmationNumber}
				</span>
			{/if}
		</div>

		<div class="grid gap-4 sm:grid-cols-2">
			<div>
				<Label for="holdingId">Holding</Label>
				<NativeSelect.Root id="holdingId" bind:value={noteEdit.holdingId}>
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
				<NativeSelect.Root id="type" bind:value={noteEdit.type}>
					<NativeSelect.Option value="">Select type</NativeSelect.Option>
					<NativeSelect.Option value="buy">Buy</NativeSelect.Option>
					<NativeSelect.Option value="sell">Sell</NativeSelect.Option>
					<NativeSelect.Option value="reinvestment">Reinvestment</NativeSelect.Option>
				</NativeSelect.Root>
			</div>

			<div>
				<Label for="transactionDate">Execution date</Label>
				<Input id="transactionDate" type="date" bind:value={noteEdit.transactionDate} />
			</div>

			<div>
				<Label for="quantity">Quantity</Label>
				<Input
					id="quantity"
					type="number"
					min="1"
					bind:value={noteEdit.quantity}
					class="tabular-nums"
				/>
			</div>

			<div>
				<Label for="pricePerUnit">Price per unit</Label>
				<Input
					id="pricePerUnit"
					type="number"
					step="0.01"
					bind:value={noteEdit.pricePerUnit}
					class="tabular-nums"
				/>
			</div>

			<div>
				<Label for="value">Total value</Label>
				<Input
					id="value"
					type="number"
					step="0.01"
					bind:value={noteEdit.value}
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
					type="number"
					step="0.01"
					bind:value={noteEdit.brokerage}
					class="tabular-nums"
				/>
			</div>

			{#if note.parsed.netAmount !== null}
				<div>
					<Label for="net">Net {note.parsed.side === 'buy' ? 'cost' : 'proceeds'}</Label>
					<p id="net" class="mt-1 text-sm tabular-nums">{formatCurrency(note.parsed.netAmount)}</p>
					<p class="mt-1 text-[11px] text-muted-foreground">From the note, for checking only.</p>
				</div>
			{/if}
		</div>

		{#if saveError}
			<p class="text-[13px] text-destructive">{saveError}</p>
		{/if}

		<div class="flex items-center justify-end gap-2 border-t border-border pt-4">
			<Button
				variant="ghost"
				href={resolve('/(dashboard)/portfolios/[portfolioId]/(tabs)', { portfolioId })}
			>
				Cancel
			</Button>
			<Button
				onclick={saveTrade}
				disabled={saving || note.duplicate || !noteEdit.holdingId || !noteEdit.type}
			>
				{saving ? 'Saving…' : 'Save transaction'}
			</Button>
		</div>
	</div>
{/if}

{#if statement}
	{@const allNotes = [...statement.statement.warnings, ...statement.rows.flatMap((r) => r.notes)]}
	{#if allNotes.length > 0}
		{@render warningPanel(allNotes)}
	{/if}

	<div class="card space-y-4">
		<div class="flex items-center gap-2 border-b border-border pb-3">
			<Coins class="size-4 text-muted-foreground" />
			<p class="text-sm font-semibold">Confirm the distributions</p>
			{#if statement.statement.periodEnd}
				<span class="ml-auto text-[11px] text-muted-foreground">
					Period ended {statement.statement.periodEnd}
				</span>
			{/if}
		</div>

		<div class="grid gap-4 sm:grid-cols-2">
			<div>
				<Label for="paymentDate">Payment date</Label>
				<Input id="paymentDate" type="date" bind:value={paymentDate} />
			</div>
			<div>
				<Label for="recordDate">Record date</Label>
				<Input id="recordDate" type="date" bind:value={recordDate} />
			</div>
		</div>

		<Table.Root>
			<Table.Header>
				<Table.Row>
					<Table.Head class="w-10"></Table.Head>
					<Table.Head>Holding</Table.Head>
					<Table.Head class="text-right">Cash per security</Table.Head>
					<Table.Head class="text-right">Units</Table.Head>
					<Table.Head class="text-right">Gross</Table.Head>
					<Table.Head class="text-right">Tax withheld</Table.Head>
					<Table.Head class="text-right">Reinvested</Table.Head>
				</Table.Row>
			</Table.Header>
			<Table.Body>
				{#each statement.rows as row (row.ticker)}
					<Table.Row>
						<Table.Cell>
							<Checkbox
								checked={rowEdits[row.ticker]?.include ?? false}
								disabled={!row.holdingId}
								onCheckedChange={(v) => (rowEdits[row.ticker].include = v === true)}
								aria-label="Import the {row.ticker} distribution"
							/>
						</Table.Cell>
						<Table.Cell>
							<p class="font-medium">{row.ticker}</p>
							<p class="text-[11px] text-muted-foreground">
								{row.holdingName ?? `${row.fundName} — not held in this portfolio`}
							</p>
						</Table.Cell>
						<Table.Cell class="text-right tabular-nums">{rate(row.centsPerUnit)}</Table.Cell>
						<Table.Cell class="text-right">
							<Input
								type="number"
								min="0"
								bind:value={
									() => rowEdits[row.ticker]?.units ?? 0,
									(v) => (rowEdits[row.ticker].units = Number(v) || 0)
								}
								class="h-8 w-24 text-right tabular-nums"
								aria-label="{row.ticker} units"
							/>
						</Table.Cell>
						<Table.Cell class="text-right">
							<Input
								type="number"
								step="0.01"
								bind:value={
									() => rowEdits[row.ticker]?.gross ?? '',
									(v) => (rowEdits[row.ticker].gross = String(v))
								}
								class="h-8 w-28 text-right tabular-nums"
								aria-label="{row.ticker} gross payment"
							/>
						</Table.Cell>
						<Table.Cell class="text-right">
							<Input
								type="number"
								step="0.01"
								bind:value={
									() => rowEdits[row.ticker]?.tax ?? '',
									(v) => (rowEdits[row.ticker].tax = String(v))
								}
								class="h-8 w-28 text-right tabular-nums"
								aria-label="{row.ticker} tax withheld"
							/>
						</Table.Cell>
						<Table.Cell class="text-right">
							<Checkbox
								checked={rowEdits[row.ticker]?.reinvested ?? false}
								onCheckedChange={(v) => (rowEdits[row.ticker].reinvested = v === true)}
								aria-label="{row.ticker} was reinvested"
							/>
						</Table.Cell>
					</Table.Row>
				{/each}
			</Table.Body>
			<Table.Footer>
				<Table.Row>
					<Table.Cell colspan={4} class="font-medium">
						{chosenRows.length} of {statement.rows.length} to import
					</Table.Cell>
					<Table.Cell class="text-right font-semibold">{formatCurrency(chosenTotal)}</Table.Cell>
					<Table.Cell colspan={2}></Table.Cell>
				</Table.Row>
			</Table.Footer>
		</Table.Root>

		{#if statement.statement.totals.grossPayment !== null}
			<p class="text-[11px] text-muted-foreground">
				The statement totals {formatCurrency(statement.statement.totals.grossPayment)} across every holding
				it covers.
			</p>
		{/if}

		{#if saveError}
			<p class="text-[13px] text-destructive">{saveError}</p>
		{/if}

		<div class="flex items-center justify-end gap-2 border-t border-border pt-4">
			<Button
				variant="ghost"
				href={resolve('/(dashboard)/portfolios/[portfolioId]/(tabs)', { portfolioId })}
			>
				Cancel
			</Button>
			<Button onclick={saveDistributions} disabled={chosenRows.length === 0 || !paymentDate}>
				Save {chosenRows.length === 1 ? 'distribution' : 'distributions'}
			</Button>
		</div>
	</div>
{/if}
