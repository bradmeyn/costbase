<script lang="ts">
	import { page } from '$app/state';
	import * as Table from '$ui/table';
	import SummaryCard from '#lib/components/summary-card.svelte';
	import { getPortfolioTaxSummary } from '#lib/remotes/portfolio.remote.js';
	import { getPortfolioAmitStatements } from '#lib/remotes/amit.remote.js';
	import { formatCurrency } from '#lib/utils/formatters.js';
	import {
		netCostBaseAmount,
		financialYearStart,
		financialYearEnd
	} from '#lib/utils/amit-calculations.js';
	import { calculateCGT } from '#lib/utils/cgt-calculations.js';
	import { AMIT_PART_A } from '#lib/schemas/amit.js';
	import { getPortfolio } from '#lib/remotes/portfolio.remote.js';
	import Button from '$ui/button/button.svelte';
	import { Printer } from '@lucide/svelte';

	const portfolioId = $derived(page.params.portfolioId!);
	const portfolio = $derived(await getPortfolio(portfolioId));

	const [taxSummary, statements] = $derived(
		await Promise.all([
			getPortfolioTaxSummary(portfolioId),
			getPortfolioAmitStatements(portfolioId)
		])
	);

	/** Every realised disposal, regardless of year. */
	const allGains = $derived([
		...taxSummary.realisedGains.shortTerm,
		...taxSummary.realisedGains.longTerm
	]);

	/** FY (ending year) of a date: anything from 1 July belongs to the next year. */
	const fyOf = (d: Date | string) => {
		const date = new Date(d);
		return date.getMonth() >= 6 ? date.getFullYear() + 1 : date.getFullYear();
	};

	/** Years with either a disposal or an AMMA statement, newest first. */
	const availableYears = $derived(
		[
			...new Set([
				...allGains.map((g) => fyOf(g.saleDate)),
				...statements.map((s) => s.financialYear)
			])
		].sort((a, b) => b - a)
	);

	// Default to the most recent year with activity — at tax time you file the year
	// that just ended, not the one you are in.
	let selectedFy = $state<number | null>(null);
	const reportFy = $derived(selectedFy ?? availableYears[0] ?? new Date().getFullYear());

	const fyStart = $derived(financialYearStart(reportFy));
	const fyEnd = $derived(financialYearEnd(reportFy));
	const fyLabel = $derived(`FY${reportFy - 1}-${reportFy}`);

	const yearGains = $derived(allGains.filter((g) => fyOf(g.saleDate) === reportFy));
	const shortTermGains = $derived(yearGains.filter((g) => !g.isLongTerm && g.gain > 0));
	const longTermGains = $derived(yearGains.filter((g) => g.isLongTerm && g.gain > 0));
	const capitalLosses = $derived(yearGains.filter((g) => g.gain < 0));

	const totalShort = $derived(shortTermGains.reduce((s, g) => s + g.gain, 0));
	const totalLong = $derived(longTermGains.reduce((s, g) => s + g.gain, 0));
	const totalLosses = $derived(Math.abs(capitalLosses.reduce((s, g) => s + g.gain, 0)));

	const cgt = $derived(calculateCGT(totalShort, totalLong, totalLosses));

	const fyStatements = $derived(statements.filter((s) => s.financialYear === reportFy));

	const totalExcessGains = $derived(
		taxSummary.amitExcessGains.reduce((sum, e) => sum + e.amount, 0)
	);

	/** 18H — total current year capital gains, before losses and discount. */
	const label18H = $derived(totalShort + totalLong + totalExcessGains);

	const formatDate = (d: Date | string) =>
		new Date(d).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' });

	/** Sum one Part A label across every statement for the year. */
	const labelTotal = (field: string) =>
		fyStatements.reduce((sum, s) => sum + Number(s[field as keyof typeof s] ?? 0), 0);
</script>

<svelte:head>
	<title>Capital gains report {fyLabel} | Costbase</title>
</svelte:head>

<!-- Only shown on paper: the app chrome that normally names the portfolio is hidden. -->
<div class="mb-4 hidden print:block">
	<h1 class="text-xl font-semibold">{portfolio.name} — capital gains report</h1>
	<p class="text-[13px]">
		{formatDate(fyStart)} to {formatDate(fyEnd)} · prepared {formatDate(new Date())}
	</p>
</div>

<div class="mb-5 flex flex-wrap items-end justify-between gap-3 print:hidden">
	<div>
		<h1 class="text-2xl font-semibold tracking-tight">Capital gains report</h1>
		<p class="mt-1 text-[13px] text-muted-foreground">
			{formatDate(fyStart)} to {formatDate(fyEnd)} · first in, first out · cost base includes AMIT adjustments
		</p>
	</div>
	<div class="flex items-end gap-3">
		<Button variant="ghost" onclick={() => window.print()}>
			<Printer class="size-4" />
			Export PDF
		</Button>
		{#if availableYears.length > 1}
			<div class="flex gap-1">
				{#each availableYears as year (year)}
					<button
						type="button"
						onclick={() => (selectedFy = year)}
						class="rounded-md border px-2.5 py-1 text-[13px] tabular-nums transition-colors {year ===
						reportFy
							? 'border-primary/30 bg-primary/15 text-foreground'
							: 'border-transparent text-muted-foreground hover:text-foreground'}"
					>
						FY{year}
					</button>
				{/each}
			</div>
		{/if}
	</div>
</div>

<!-- Headline labels -->
<div class="mb-5 grid gap-2 sm:grid-cols-3">
	<SummaryCard label="Total current year capital gains (18H)" value={formatCurrency(label18H)} />
	<SummaryCard label="Net capital gain (18A)" value={formatCurrency(cgt.totalTaxableGain)} />
	<SummaryCard label="CGT discount applied" value={formatCurrency(cgt.cgtDiscount)} />
</div>

<!-- 18A working -->
<section class="card mb-5">
	<h2 class="mb-3 text-base font-semibold">Net capital gain working (18A)</h2>
	<Table.Root>
		<Table.Body>
			<Table.Row>
				<Table.Cell>Short term gains</Table.Cell>
				<Table.Cell class="text-right tabular-nums">{formatCurrency(cgt.shortTermGains)}</Table.Cell
				>
			</Table.Row>
			<Table.Row>
				<Table.Cell class="text-muted-foreground">less capital losses applied</Table.Cell>
				<Table.Cell class="text-right text-loss tabular-nums">
					{formatCurrency(-cgt.lossesAppliedToShortTerm)}
				</Table.Cell>
			</Table.Row>
			<Table.Row>
				<Table.Cell>Long term gains</Table.Cell>
				<Table.Cell class="text-right tabular-nums">{formatCurrency(cgt.longTermGains)}</Table.Cell>
			</Table.Row>
			<Table.Row>
				<Table.Cell class="text-muted-foreground">less capital losses applied</Table.Cell>
				<Table.Cell class="text-right text-loss tabular-nums">
					{formatCurrency(-cgt.lossesAppliedToLongTerm)}
				</Table.Cell>
			</Table.Row>
			<Table.Row>
				<Table.Cell class="text-muted-foreground">less CGT discount at 50%</Table.Cell>
				<Table.Cell class="text-right text-loss tabular-nums">
					{formatCurrency(-cgt.cgtDiscount)}
				</Table.Cell>
			</Table.Row>
			{#if totalExcessGains > 0}
				<Table.Row>
					<Table.Cell>
						AMIT cost base excess gains
						<span class="text-[11px] text-muted-foreground">(CGT event E10)</span>
					</Table.Cell>
					<Table.Cell class="text-right tabular-nums">{formatCurrency(totalExcessGains)}</Table.Cell
					>
				</Table.Row>
			{/if}
			<Table.Row>
				<Table.Cell class="font-semibold">Net capital gain</Table.Cell>
				<Table.Cell class="text-right font-semibold tabular-nums">
					{formatCurrency(cgt.totalTaxableGain)}
				</Table.Cell>
			</Table.Row>
		</Table.Body>
	</Table.Root>
</section>

<!-- Per holding -->
<section class="card mb-5">
	<h2 class="mb-3 text-base font-semibold">By holding</h2>
	<Table.Root>
		<Table.Header>
			<Table.Row>
				<Table.Head>Holding</Table.Head>
				<Table.Head class="text-right">Short term</Table.Head>
				<Table.Head class="text-right">Long term</Table.Head>
				<Table.Head class="text-right">Losses</Table.Head>
				<Table.Head class="text-right">Cost base adj.</Table.Head>
			</Table.Row>
		</Table.Header>
		<Table.Body>
			{#each taxSummary.holdings as holding (holding.id)}
				{@const short = shortTermGains
					.filter((g) => g.holdingCode === holding.code)
					.reduce((s, g) => s + g.gain, 0)}
				{@const long = longTermGains
					.filter((g) => g.holdingCode === holding.code)
					.reduce((s, g) => s + g.gain, 0)}
				{@const losses = capitalLosses
					.filter((g) => g.holdingCode === holding.code)
					.reduce((s, g) => s + g.gain, 0)}
				{@const stmt = fyStatements.find((s) => s.holdingCode === holding.code)}
				{@const adj = stmt ? netCostBaseAmount(stmt) : 0}
				<Table.Row>
					<Table.Cell>
						<span class="font-medium">{holding.code}</span>
						<span class="text-muted-foreground">{holding.name}</span>
					</Table.Cell>
					<Table.Cell class="text-right tabular-nums">{formatCurrency(short)}</Table.Cell>
					<Table.Cell class="text-right tabular-nums">{formatCurrency(long)}</Table.Cell>
					<Table.Cell class="text-right tabular-nums {losses < 0 ? 'text-loss' : ''}">
						{formatCurrency(losses)}
					</Table.Cell>
					<Table.Cell
						class="text-right tabular-nums {adj < 0
							? 'text-loss'
							: adj > 0
								? 'text-gain'
								: 'text-muted-foreground'}"
					>
						{#if stmt}{adj > 0 ? '+' : ''}{formatCurrency(adj)}{:else}—{/if}
					</Table.Cell>
				</Table.Row>
			{/each}
		</Table.Body>
	</Table.Root>
</section>

<!-- Disposals -->
<section class="card mb-5">
	<h2 class="mb-3 text-base font-semibold">Disposals</h2>
	{#if longTermGains.length + shortTermGains.length + capitalLosses.length === 0}
		<p class="text-[13px] text-muted-foreground">No disposals in {fyLabel}.</p>
	{:else}
		<Table.Root>
			<Table.Header>
				<Table.Row>
					<Table.Head>Holding</Table.Head>
					<Table.Head>Acquired</Table.Head>
					<Table.Head>Disposed</Table.Head>
					<Table.Head class="text-right">Units</Table.Head>
					<Table.Head class="text-right">Cost base</Table.Head>
					<Table.Head class="text-right">Proceeds</Table.Head>
					<Table.Head class="text-right">Gain</Table.Head>
					<Table.Head>Method</Table.Head>
				</Table.Row>
			</Table.Header>
			<Table.Body>
				{#each [...longTermGains, ...shortTermGains, ...capitalLosses] as g, i (i)}
					<Table.Row>
						<Table.Cell class="font-medium">{g.holdingCode}</Table.Cell>
						<Table.Cell class="text-muted-foreground">—</Table.Cell>
						<Table.Cell>{formatDate(g.saleDate)}</Table.Cell>
						<Table.Cell class="text-right tabular-nums">{g.quantity}</Table.Cell>
						<Table.Cell class="text-right tabular-nums">{formatCurrency(g.costBase)}</Table.Cell>
						<Table.Cell class="text-right tabular-nums">{formatCurrency(g.proceeds)}</Table.Cell>
						<Table.Cell class="text-right tabular-nums {g.gain < 0 ? 'text-loss' : 'text-gain'}">
							{formatCurrency(g.gain)}
						</Table.Cell>
						<Table.Cell class="text-muted-foreground">
							{g.gain < 0 ? 'Loss' : g.isLongTerm ? 'Discount' : 'Other'}
						</Table.Cell>
					</Table.Row>
				{/each}
			</Table.Body>
		</Table.Root>
	{/if}
</section>

<!-- Trust distribution labels -->
<section class="card mb-10">
	<h2 class="mb-1 text-base font-semibold">Trust distributions — {fyLabel}</h2>
	<p class="mb-3 text-[11px] text-muted-foreground">
		From the AMMA statements. Totals across all holdings are what you enter on the supplementary
		section.
	</p>
	{#if fyStatements.length === 0}
		<p class="text-[13px] text-muted-foreground">
			No AMMA statements entered for FY{reportFy}. Add them from each holding.
		</p>
	{:else}
		<Table.Root>
			<Table.Header>
				<Table.Row>
					<Table.Head class="w-12">Label</Table.Head>
					<Table.Head>Item</Table.Head>
					{#each fyStatements as s (s.id)}
						<Table.Head class="text-right">{s.holdingCode}</Table.Head>
					{/each}
					<Table.Head class="text-right">Total</Table.Head>
				</Table.Row>
			</Table.Header>
			<Table.Body>
				{#each AMIT_PART_A as [field, code, label] (field)}
					{@const total = labelTotal(field)}
					<Table.Row>
						<Table.Cell class="font-medium text-brand-3 tabular-nums">{code}</Table.Cell>
						<Table.Cell class="text-muted-foreground">{label}</Table.Cell>
						{#each fyStatements as s (s.id)}
							<Table.Cell class="text-right tabular-nums">
								{formatCurrency(Number(s[field as keyof typeof s] ?? 0))}
							</Table.Cell>
						{/each}
						<Table.Cell class="text-right font-medium tabular-nums">
							{formatCurrency(total)}
						</Table.Cell>
					</Table.Row>
				{/each}
			</Table.Body>
		</Table.Root>
	{/if}
</section>
