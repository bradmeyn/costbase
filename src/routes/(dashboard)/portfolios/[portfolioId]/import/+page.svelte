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
	import { ArrowLeft, TriangleAlert, FileText, Coins, Upload, Paperclip } from '@lucide/svelte';
	import { getPortfolio } from '#lib/remotes/portfolio.remote.js';
	import {
		previewImport,
		importContractNote,
		importContractNotes,
		attachNotesToTransactions,
		importDistributionStatement,
		importAmitStatement,
		importAnnualStatement
	} from '#lib/remotes/import.remote.js';
	import { formatCurrency } from '#lib/utils.js';
	import { financialYearLabel } from '#lib/report-period.js';

	const portfolioId = $derived(page.params.portfolioId!);
	const portfolio = $derived(await getPortfolio(portfolioId));

	type Preview = Awaited<ReturnType<typeof previewImport>>;
	/** Files are held client-side so the confirmed step can re-send the same bytes. */
	type Read = { file: File; preview: Preview; include: boolean };

	let reads = $state<Read[]>([]);
	let reading = $state(0);
	let saveError = $state('');

	const notes = $derived(reads.filter((r) => r.preview.kind === 'contract-note'));
	const statements = $derived(reads.filter((r) => r.preview.kind === 'distribution-statement'));
	const unreadable = $derived(reads.filter((r) => r.preview.kind === 'unknown'));
	const taxStatements = $derived(reads.filter((r) => r.preview.kind === 'tax-statement'));
	const annualStatements = $derived(reads.filter((r) => r.preview.kind === 'annual-statement'));

	/*
	  One note gets the full form, because a one-off is usually one you want to look
	  over. A batch gets a list: the point of dropping twelve notes is not to fill in
	  twelve forms, and anything that needs a correction can be edited after.
	*/
	type NotePreview = Extract<Preview, { kind: 'contract-note' }>;
	const asNote = (r: Read) => r.preview as NotePreview;

	/* A note for a trade already recorded is paperwork to file, not a trade to import. */
	const newTrades = $derived(notes.filter((r) => !asNote(r).matchedTransactionId));
	/*
	  A note belongs in this list when the trade has no document yet, and also when the
	  row is short a figure the note carries — filing completes the row either way.
	*/
	const toFile = $derived(
		notes.filter(
			(r) =>
				asNote(r).matchedTransactionId &&
				(!asNote(r).matchedHasDocument || asNote(r).matchedNeedsFigures)
		)
	);
	const alreadyFiled = $derived(
		notes.filter((r) => asNote(r).matchedHasDocument && !asNote(r).matchedNeedsFigures)
	);

	const single = $derived(
		newTrades.length === 1 && notes.length === 1 && statements.length === 0 ? notes[0] : null
	);
	const note = $derived(single && single.preview.kind === 'contract-note' ? single.preview : null);
	/*
	  Statements are confirmed one at a time even when several are dropped: each is a
	  different date with its own rows, and there is no useful way to check six at once.
	  Saving one takes the next off the queue.
	*/
	const statementRead = $derived(statements[0] ?? null);
	const statement = $derived(
		statementRead?.preview.kind === 'distribution-statement' ? statementRead.preview : null
	);
	const file = $derived(single?.file ?? statementRead?.file ?? null);

	const chosenNotes = $derived(newTrades.filter((r) => r.include));
	const chosenToFile = $derived(toFile.filter((r) => r.include));
	/** Notes whose ticker is not a holding here — nothing can be written for these. */
	const unmatched = $derived(
		newTrades.filter((r) => r.preview.kind === 'contract-note' && !r.preview.holdingId)
	);

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
					// A reinvestment statement says so itself; no need to tick it by hand.
					reinvested: statement.statement.kind === 'reinvestment'
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

	async function accept(picked: File[]) {
		const pdfs = picked.filter((f) => f.type === 'application/pdf');
		if (pdfs.length === 0) return;

		saveError = '';
		reading += pdfs.length;
		await Promise.all(
			pdfs.map(async (f) => {
				try {
					const preview = await previewImport({ portfolioId, file: f });
					// Only a note with nothing left to add needs no decision.
					const done =
						preview.kind === 'contract-note' &&
						preview.matchedHasDocument &&
						!preview.matchedNeedsFigures;
					reads = [...reads, { file: f, preview, include: !done }];
				} catch (e) {
					saveError = e instanceof Error ? e.message : `${f.name} could not be read.`;
				} finally {
					reading -= 1;
				}
			})
		);
	}

	function onFile(event: Event) {
		const input = event.currentTarget as HTMLInputElement;
		accept([...(input.files ?? [])]);
		// Cleared so choosing the same file twice still fires a change event.
		input.value = '';
	}

	let dragging = $state(false);

	function onDrop(event: DragEvent) {
		event.preventDefault();
		dragging = false;
		accept([...(event.dataTransfer?.files ?? [])]);
	}

	function removeRead(read: Read) {
		reads = reads.filter((r) => r !== read);
	}

	function clearAll() {
		reads = [];
		saveError = '';
	}

	async function fileMatched() {
		if (chosenToFile.length === 0) return;
		saveError = '';
		saving = true;
		try {
			const result = await attachNotesToTransactions({
				portfolioId,
				notes: chosenToFile.map((r) => ({
					file: r.file,
					transactionId: asNote(r).matchedTransactionId!,
					platform: asNote(r).parsed.platform ?? undefined,
					value: asNote(r).parsed.value ?? undefined
				}))
			});
			// Drop what was filed so the list shows only what is left to decide.
			const done = new Set(chosenToFile);
			reads = reads.filter((r) => !done.has(r));
			filedCount += result.attached;
		} catch (e) {
			saveError = e instanceof Error ? e.message : 'Those documents could not be filed.';
		} finally {
			saving = false;
		}
	}

	let filedCount = $state(0);
	let savedDistributions = $state(0);
	let savedStatements = $state(0);
	let savedAnnual = $state(0);

	const savableAnnual = $derived(
		annualStatements.filter(
			(r) =>
				r.preview.kind === 'annual-statement' &&
				r.preview.holdingId &&
				r.preview.parsed.financialYear &&
				r.preview.parsed.periodEnd
		)
	);

	async function saveAnnual() {
		if (savableAnnual.length === 0) return;
		saveError = '';
		saving = true;
		try {
			for (const read of savableAnnual) {
				const p = read.preview as Extract<Preview, { kind: 'annual-statement' }>;
				await importAnnualStatement({
					portfolioId,
					holdingId: p.holdingId!,
					financialYear: p.parsed.financialYear!,
					holderNumber: p.parsed.holderNumber,
					periodEnd: p.parsed.periodEnd!,
					openingUnits: p.parsed.openingUnits ?? 0,
					closingUnits: p.parsed.closingUnits ?? 0,
					closingUnitPrice: p.parsed.closingUnitPrice ?? 0,
					closingValue: p.parsed.closingValue ?? 0,
					cashDistributionReceived: p.parsed.cashDistributionReceived ?? 0,
					totalFees: p.parsed.totalFees ?? 0,
					file: read.file
				});
				savedAnnual += 1;
			}
			const done = new Set(savableAnnual);
			reads = reads.filter((r) => !done.has(r));
		} catch (e) {
			saveError = e instanceof Error ? e.message : 'Those statements could not be saved.';
		} finally {
			saving = false;
		}
	}

	/*
	  A tax statement is one holding's figures for one year, straight off the document.
	  There is nothing to choose between, so the whole batch saves at once.
	*/
	const savableStatements = $derived(
		taxStatements.filter(
			(r) =>
				r.preview.kind === 'tax-statement' && r.preview.holdingId && r.preview.parsed.financialYear
		)
	);

	async function saveStatements() {
		if (savableStatements.length === 0) return;
		saveError = '';
		saving = true;
		try {
			for (const read of savableStatements) {
				const p = read.preview as Extract<Preview, { kind: 'tax-statement' }>;
				await importAmitStatement({
					portfolioId,
					holdingId: p.holdingId!,
					financialYear: p.parsed.financialYear!,
					holderNumber: p.parsed.holderNumber,
					amounts: p.parsed.amounts,
					file: read.file
				});
				savedStatements += 1;
			}
			const done = new Set(savableStatements);
			reads = reads.filter((r) => !done.has(r));
		} catch (e) {
			saveError = e instanceof Error ? e.message : 'Those statements could not be saved.';
		} finally {
			saving = false;
		}
	}

	async function saveBatch() {
		if (chosenNotes.length === 0) return;
		saveError = '';
		saving = true;
		try {
			await importContractNotes({
				portfolioId,
				notes: chosenNotes.map((r) => {
					const p = r.preview as Extract<Preview, { kind: 'contract-note' }>;
					return {
						file: r.file,
						holdingId: p.holdingId ?? '',
						type: (p.parsed.side ?? 'buy') as 'buy' | 'sell' | 'reinvestment',
						quantity: p.parsed.quantity ?? 0,
						pricePerUnit: p.parsed.pricePerUnit ?? 0,
						value: p.parsed.value ?? 0,
						brokerage: p.parsed.brokerage ?? 0,
						transactionDate: p.parsed.executionDate ?? '',
						confirmationNumber: p.parsed.confirmationNumber ?? undefined,
						platform: p.parsed.platform ?? undefined
					};
				})
			});
			await goto(
				resolve('/(dashboard)/portfolios/[portfolioId]/(tabs)/reports/transactions', {
					portfolioId
				})
			);
		} catch (e) {
			saveError = e instanceof Error ? e.message : 'Those trades could not be saved.';
		} finally {
			saving = false;
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
				confirmationNumber: note?.parsed.confirmationNumber ?? undefined,
				platform: note?.parsed.platform ?? undefined
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
			// Off the queue, so the next statement comes up rather than navigating away.
			savedDistributions += chosenRows.length;
			if (statementRead) reads = reads.filter((r) => r !== statementRead);
			if (statements.length === 0 && newTrades.length === 0 && toFile.length === 0) {
				await goto(
					resolve('/(dashboard)/portfolios/[portfolioId]/(tabs)/reports/distributions', {
						portfolioId
					})
				);
			}
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

<!--
	One drop target for every kind of document. The heading inside the PDF says what
	it is, so asking which sort you have before you drop it would be asking you to do
	work the parser already does.
-->
<label
	for="document"
	ondragover={(e) => {
		e.preventDefault();
		dragging = true;
	}}
	ondragleave={() => (dragging = false)}
	ondrop={onDrop}
	class="mb-5 flex cursor-pointer flex-col items-center justify-center rounded-md border border-dashed px-6 py-10 text-center transition-colors {dragging
		? 'border-primary bg-primary/10'
		: 'border-border bg-card hover:border-primary/50'}"
>
	<Upload class="size-5 text-muted-foreground" />
	<p class="mt-2 text-sm font-medium">Drop contract notes and statements here</p>
	<p class="mt-1 text-[13px] text-muted-foreground">
		Or click to choose. Several at once is fine — PDFs only.
	</p>
	<input
		id="document"
		type="file"
		accept="application/pdf"
		multiple
		onchange={onFile}
		class="sr-only"
	/>
</label>

{#if reading > 0}
	<p class="mb-5 text-[13px] text-muted-foreground">
		Reading {reading}
		{reading === 1 ? 'document' : 'documents'}…
	</p>
{/if}

{#if unreadable.length > 0}
	<div class="mb-5 rounded-md border border-border bg-card p-4">
		<p class="text-[13px] font-medium">Not recognised</p>
		<ul class="mt-2 space-y-1">
			{#each unreadable as read (read.file.name)}
				<li class="flex items-center justify-between gap-3 text-[13px] text-muted-foreground">
					<span class="truncate">{read.file.name}</span>
					<Button variant="ghost" size="sm" onclick={() => removeRead(read)}>Remove</Button>
				</li>
			{/each}
		</ul>
		<p class="mt-2 text-[11px] text-muted-foreground">
			Neither a contract note nor a distribution statement. Enter these by hand.
		</p>
	</div>
{/if}

{#if filedCount > 0 || savedDistributions > 0 || savedStatements > 0 || savedAnnual > 0}
	<p class="mb-5 rounded-md border border-primary/30 bg-primary/10 px-3.5 py-3 text-[13px]">
		{#if filedCount > 0}
			{filedCount}
			{filedCount === 1 ? 'document' : 'documents'} filed against trades already recorded.
		{/if}
		{#if savedDistributions > 0}
			{savedDistributions}
			{savedDistributions === 1 ? 'distribution' : 'distributions'} saved.
		{/if}
		{#if savedStatements > 0}
			{savedStatements}
			{savedStatements === 1 ? 'tax statement' : 'tax statements'} saved.
		{/if}
		{#if savedAnnual > 0}
			{savedAnnual}
			{savedAnnual === 1 ? 'annual statement' : 'annual statements'} saved.
		{/if}
	</p>
{/if}

{#if annualStatements.length > 0}
	<div class="card mb-5 space-y-4">
		<div class="flex items-center gap-2 border-b border-border pb-3">
			<FileText class="size-4 text-muted-foreground" />
			<p class="text-sm font-semibold">Registry annual statements</p>
			<span class="ml-auto text-[11px] text-muted-foreground">
				{savableAnnual.length} of {annualStatements.length} to save
			</span>
		</div>

		<p class="text-[13px] text-muted-foreground">
			No tax figures come from these — the statement says as much itself. They are kept as the
			registry's own count of units and cash, to check the transactions and distributions against.
		</p>

		<Table.Root>
			<Table.Header>
				<Table.Row>
					<Table.Head>Document</Table.Head>
					<Table.Head>Holding</Table.Head>
					<Table.Head>Year</Table.Head>
					<Table.Head class="text-right">Units at close</Table.Head>
					<Table.Head class="text-right">Cash paid</Table.Head>
					<Table.Head class="w-10"></Table.Head>
				</Table.Row>
			</Table.Header>
			<Table.Body>
				{#each annualStatements as read (read.file.name)}
					{@const p = read.preview as Extract<Preview, { kind: 'annual-statement' }>}
					<Table.Row>
						<Table.Cell class="max-w-64 truncate text-[13px]">{read.file.name}</Table.Cell>
						<Table.Cell class="text-[13px]">
							{p.holdingName ?? `${p.parsed.ticker ?? '—'} — not held here`}
						</Table.Cell>
						<Table.Cell class="text-[13px]">
							{p.parsed.financialYear ? financialYearLabel(p.parsed.financialYear) : '—'}
							{#if p.parsed.holderNumber}
								<span class="text-[11px] text-muted-foreground">···{p.parsed.holderNumber}</span>
							{/if}
						</Table.Cell>
						<Table.Cell class="text-right tabular-nums">{p.parsed.closingUnits ?? '—'}</Table.Cell>
						<Table.Cell class="text-right tabular-nums">
							{formatCurrency(p.parsed.cashDistributionReceived ?? 0)}
						</Table.Cell>
						<Table.Cell class="text-right">
							<Button variant="ghost" size="sm" onclick={() => removeRead(read)}>Remove</Button>
						</Table.Cell>
					</Table.Row>
				{/each}
			</Table.Body>
		</Table.Root>

		{#each annualStatements.flatMap((r) => (r.preview as Extract<Preview, { kind: 'annual-statement' }>).parsed.warnings) as warning, i (i)}
			<p class="text-[13px] text-brand-2">{warning}</p>
		{/each}

		<div class="flex items-center justify-end gap-2 border-t border-border pt-4">
			<Button onclick={saveAnnual} disabled={saving || savableAnnual.length === 0}>
				{saving
					? 'Saving…'
					: `Save ${savableAnnual.length} ${savableAnnual.length === 1 ? 'statement' : 'statements'}`}
			</Button>
		</div>
	</div>
{/if}

{#if taxStatements.length > 0}
	{@const unplaceable = taxStatements.filter((r) => !savableStatements.includes(r))}
	<div class="card mb-5 space-y-4">
		<div class="flex items-center gap-2 border-b border-border pb-3">
			<FileText class="size-4 text-muted-foreground" />
			<p class="text-sm font-semibold">Annual tax statements</p>
			<span class="ml-auto text-[11px] text-muted-foreground">
				{savableStatements.length} of {taxStatements.length} to save
			</span>
		</div>

		<Table.Root>
			<Table.Header>
				<Table.Row>
					<Table.Head>Document</Table.Head>
					<Table.Head>Holding</Table.Head>
					<Table.Head>Year</Table.Head>
					<Table.Head class="text-right">13U</Table.Head>
					<Table.Head class="text-right">13C</Table.Head>
					<Table.Head class="text-right">18H</Table.Head>
					<Table.Head class="text-right">Cost base adj.</Table.Head>
					<Table.Head class="w-10"></Table.Head>
				</Table.Row>
			</Table.Header>
			<Table.Body>
				{#each taxStatements as read (read.file.name)}
					{@const p = read.preview as Extract<Preview, { kind: 'tax-statement' }>}
					{@const a = p.parsed.amounts}
					{@const adjustment = (a.amitCostBaseShortfall ?? 0) - (a.amitCostBaseExcess ?? 0)}
					<Table.Row>
						<Table.Cell class="max-w-64 truncate text-[13px]">{read.file.name}</Table.Cell>
						<Table.Cell class="text-[13px]">
							{p.holdingName ?? `${p.parsed.ticker ?? '—'} — not held here`}
						</Table.Cell>
						<Table.Cell class="text-[13px]">
							{p.parsed.financialYear ? financialYearLabel(p.parsed.financialYear) : '—'}
						</Table.Cell>
						<Table.Cell class="text-right tabular-nums">
							{formatCurrency(Math.round((a.label13U ?? 0) * 100))}
						</Table.Cell>
						<Table.Cell class="text-right tabular-nums">
							{formatCurrency(Math.round((a.label13C ?? 0) * 100))}
						</Table.Cell>
						<Table.Cell class="text-right tabular-nums">
							{formatCurrency(Math.round((a.label18H ?? 0) * 100))}
						</Table.Cell>
						<Table.Cell
							class="text-right tabular-nums {adjustment < 0
								? 'text-loss'
								: adjustment > 0
									? 'text-gain'
									: ''}"
						>
							{adjustment > 0 ? '+' : ''}{formatCurrency(Math.round(adjustment * 100))}
						</Table.Cell>
						<Table.Cell class="text-right">
							<Button variant="ghost" size="sm" onclick={() => removeRead(read)}>Remove</Button>
						</Table.Cell>
					</Table.Row>
				{/each}
			</Table.Body>
		</Table.Root>

		{#each taxStatements.flatMap((r) => (r.preview as Extract<Preview, { kind: 'tax-statement' }>).parsed.warnings) as warning, i (i)}
			<p class="text-[13px] text-brand-2">{warning}</p>
		{/each}

		{#if unplaceable.length > 0}
			<p class="text-[13px] text-brand-2">
				{unplaceable.length}
				{unplaceable.length === 1 ? 'statement' : 'statements'} cannot be placed — the holding or the
				year could not be read.
			</p>
		{/if}

		{#if saveError}
			<p class="text-[13px] text-destructive">{saveError}</p>
		{/if}

		<div class="flex items-center justify-end gap-2 border-t border-border pt-4">
			<Button onclick={saveStatements} disabled={saving || savableStatements.length === 0}>
				{saving
					? 'Saving…'
					: `Save ${savableStatements.length} ${savableStatements.length === 1 ? 'statement' : 'statements'}`}
			</Button>
		</div>
	</div>
{/if}

{#if toFile.length > 0}
	<div class="card mb-5 space-y-4">
		<div class="flex items-center gap-2 border-b border-border pb-3">
			<Paperclip class="size-4 text-muted-foreground" />
			<p class="text-sm font-semibold">Already recorded</p>
			<span class="ml-auto text-[11px] text-muted-foreground">
				{chosenToFile.length} of {toFile.length} to file
			</span>
		</div>

		<p class="text-[13px] text-muted-foreground">
			These trades are already in the portfolio. Nothing will be imported — the note is filed
			against the trade it belongs to, and fills in the platform if the row has none.
		</p>

		<Table.Root>
			<Table.Header>
				<Table.Row>
					<Table.Head class="w-10"></Table.Head>
					<Table.Head>Document</Table.Head>
					<Table.Head>Trade</Table.Head>
					<Table.Head>Platform</Table.Head>
					<Table.Head class="w-10"></Table.Head>
				</Table.Row>
			</Table.Header>
			<Table.Body>
				{#each toFile as read (read.file.name)}
					{@const p = asNote(read)}
					<Table.Row>
						<Table.Cell>
							<Checkbox
								checked={read.include}
								onCheckedChange={(v) => (read.include = v === true)}
								aria-label="File {read.file.name}"
							/>
						</Table.Cell>
						<Table.Cell class="max-w-72 truncate text-[13px]">{read.file.name}</Table.Cell>
						<Table.Cell class="text-[13px]">
							{p.parsed.side === 'sell' ? 'Sell' : 'Buy'}
							{p.parsed.quantity}
							{p.parsed.ticker} on {p.parsed.executionDate}
						</Table.Cell>
						<Table.Cell class="text-[13px] text-muted-foreground">
							{p.parsed.platform ?? '—'}
						</Table.Cell>
						<Table.Cell class="text-right">
							<Button variant="ghost" size="sm" onclick={() => removeRead(read)}>Remove</Button>
						</Table.Cell>
					</Table.Row>
				{/each}
			</Table.Body>
		</Table.Root>

		{#if saveError}
			<p class="text-[13px] text-destructive">{saveError}</p>
		{/if}

		<div class="flex items-center justify-end gap-2 border-t border-border pt-4">
			<Button onclick={fileMatched} disabled={saving || chosenToFile.length === 0}>
				{saving
					? 'Filing…'
					: `File ${chosenToFile.length} ${chosenToFile.length === 1 ? 'document' : 'documents'}`}
			</Button>
		</div>
	</div>
{/if}

{#if alreadyFiled.length > 0}
	<div class="mb-5 rounded-md border border-border bg-card p-4">
		<p class="text-[13px] font-medium">Nothing to do</p>
		<p class="mt-1 text-[11px] text-muted-foreground">
			{alreadyFiled.length}
			{alreadyFiled.length === 1 ? 'note is' : 'notes are'} already recorded with a document attached.
		</p>
	</div>
{/if}

{#if newTrades.length > 1 || (newTrades.length > 0 && (statements.length > 0 || toFile.length > 0))}
	<div class="card mb-5 space-y-4">
		<div class="flex items-center gap-2 border-b border-border pb-3">
			<FileText class="size-4 text-muted-foreground" />
			<p class="text-sm font-semibold">Trades</p>
			<span class="ml-auto text-[11px] text-muted-foreground">
				{chosenNotes.length} of {newTrades.length} to import
			</span>
		</div>

		<Table.Root>
			<Table.Header>
				<Table.Row>
					<Table.Head class="w-10"></Table.Head>
					<Table.Head>Document</Table.Head>
					<Table.Head>Trade</Table.Head>
					<Table.Head class="text-right">Brokerage</Table.Head>
					<Table.Head class="text-right">Value</Table.Head>
					<Table.Head class="w-10"></Table.Head>
				</Table.Row>
			</Table.Header>
			<Table.Body>
				{#each newTrades as read (read.file.name)}
					{@const p = read.preview as Extract<Preview, { kind: 'contract-note' }>}
					<Table.Row>
						<Table.Cell>
							<Checkbox
								checked={read.include}
								disabled={!p.holdingId || p.duplicate}
								onCheckedChange={(v) => (read.include = v === true)}
								aria-label="Import {read.file.name}"
							/>
						</Table.Cell>
						<Table.Cell>
							<p class="max-w-64 truncate text-[13px]">{read.file.name}</p>
							{#if p.parsed.confirmationNumber}
								<p class="text-[11px] text-muted-foreground tabular-nums">
									Confirmation {p.parsed.confirmationNumber}
								</p>
							{/if}
						</Table.Cell>
						<Table.Cell>
							<p class="text-[13px]">
								{p.parsed.side === 'sell' ? 'Sell' : 'Buy'}
								{p.parsed.quantity}
								{p.holdingName?.split(' ')[0] ?? p.parsed.ticker} at
								{formatCurrency(p.parsed.pricePerUnit ?? 0)}
							</p>
							<p class="text-[11px] text-muted-foreground">
								{p.parsed.executionDate}
							</p>
							{#each p.parsed.warnings as warning, i (i)}
								<p class="text-[11px] text-brand-2">{warning}</p>
							{/each}
						</Table.Cell>
						<Table.Cell class="text-right tabular-nums">
							{formatCurrency(p.parsed.brokerage ?? 0)}
						</Table.Cell>
						<Table.Cell class="text-right tabular-nums">
							{formatCurrency(p.parsed.value ?? 0)}
						</Table.Cell>
						<Table.Cell class="text-right">
							<Button variant="ghost" size="sm" onclick={() => removeRead(read)}>Remove</Button>
						</Table.Cell>
					</Table.Row>
				{/each}
			</Table.Body>
		</Table.Root>

		{#if unmatched.length > 0}
			<p class="text-[13px] text-brand-2">
				{unmatched.length}
				{unmatched.length === 1 ? 'note is' : 'notes are'} for a holding this portfolio does not have.
				Add the holding first, then drop them again.
			</p>
		{/if}

		{#if saveError}
			<p class="text-[13px] text-destructive">{saveError}</p>
		{/if}

		<div class="flex items-center justify-end gap-2 border-t border-border pt-4">
			<Button variant="ghost" onclick={clearAll}>Clear</Button>
			<Button onclick={saveBatch} disabled={saving || chosenNotes.length === 0}>
				{saving
					? 'Saving…'
					: `Import ${chosenNotes.length} ${chosenNotes.length === 1 ? 'trade' : 'trades'}`}
			</Button>
		</div>
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

{#if single && note && noteEdit}
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
					{#if statements.length > 1}
						· {statements.length - 1} more to confirm
					{/if}
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
