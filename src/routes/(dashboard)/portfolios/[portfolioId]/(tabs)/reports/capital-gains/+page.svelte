<script lang="ts">
	import { page } from '$app/state';
	import { registerReport } from '#lib/report-chrome.svelte.js';
	import * as Table from '$ui/table';
	import SummaryCard from '#lib/components/summary-card.svelte';
	import { getPortfolioTaxSummary } from '#lib/remotes/portfolio.remote.js';
	import { getPortfolioAmitStatements } from '#lib/remotes/amit.remote.js';
	import { formatCurrency } from '#lib/utils.js';
	import type { ReportDocument } from '#lib/report-document.js';
	import {
		netCostBaseAmount,
		financialYearStart,
		financialYearEnd
	} from '#lib/utils/amit-calculations.js';
	import { calculateCGT } from '#lib/utils/cgt-calculations.js';
	import { financialYearLabel, readFinancialYear } from '#lib/report-period.js';
	import { AMIT_PART_A } from '#lib/schemas/amit.js';
	import { getPortfolio, getPortfolioFinancialYears } from '#lib/remotes/portfolio.remote.js';

	const portfolioId = $derived(page.params.portfolioId!);
	const portfolio = $derived(await getPortfolio(portfolioId));

	/* Driven by ?fy= so the report is linkable and the server does the filtering.
	   With no year given, fall back to the most recent one that has activity. */
	const financialYears = $derived(await getPortfolioFinancialYears(portfolioId));
	const reportFy = $derived(readFinancialYear(page.url, financialYears));

	const [taxSummary, statements] = $derived(
		await Promise.all([
			getPortfolioTaxSummary({ id: portfolioId, financialYear: reportFy }),
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

	const fyStart = $derived(financialYearStart(reportFy));
	const fyEnd = $derived(financialYearEnd(reportFy));
	const fyLabel = $derived(financialYearLabel(reportFy));

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

	/** One disposal per row, the way a CGT schedule is read. */
	const disposalSection = (heading: string, gains: typeof yearGains) => ({
		heading,
		columns: [
			{ header: 'Sold' },
			{ header: 'Code' },
			{ header: 'Units', align: 'right' as const },
			{ header: 'Proceeds', align: 'right' as const },
			{ header: 'Cost base', align: 'right' as const },
			{ header: 'Gain', align: 'right' as const }
		],
		rows: gains.map((g) => [
			formatDate(g.saleDate),
			g.holdingCode,
			g.quantity.toLocaleString('en-AU'),
			formatCurrency(g.proceeds),
			formatCurrency(g.costBase),
			formatCurrency(g.gain)
		]),
		footer: ['Total', '', '', '', '', formatCurrency(gains.reduce((sum, g) => sum + g.gain, 0))]
	});

	function reportDocument(): ReportDocument {
		return {
			title: 'Capital gains report',
			portfolioName: portfolio.name,
			subtitle: `${formatDate(fyStart)} to ${formatDate(fyEnd)} · first in, first out · cost base includes AMIT adjustments`,
			filename: `capital-gains-${fyLabel}`,
			sections: [
				{
					heading: 'Summary',
					columns: [
						{ header: 'Item', width: '*' as const },
						{ header: 'Amount', align: 'right' as const }
					],
					rows: [
						['Total current year capital gains (18H)', formatCurrency(label18H)],
						['Net capital gain (18A)', formatCurrency(cgt.totalTaxableGain)],
						['Capital losses this year', formatCurrency(totalLosses)]
					]
				},
				disposalSection('Disposals — held over 12 months', longTermGains),
				disposalSection('Disposals — held 12 months or less', shortTermGains),
				...(capitalLosses.length > 0 ? [disposalSection('Disposals at a loss', capitalLosses)] : [])
			],
			notes: [
				'Parcels are matched first in, first out. Cost bases include any AMIT adjustment applied at 30 June of each year with a statement.'
			]
		};
	}

	registerReport(() => ({
		title: 'Capital gains report',
		subtitle: `${formatDate(fyStart)} to ${formatDate(fyEnd)} · first in, first out · cost base includes AMIT adjustments`,
		document: reportDocument
	}));
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
		From the tax statements. Totals across all holdings are what you enter on the supplementary
		section.
	</p>
	{#if fyStatements.length === 0}
		<p class="text-[13px] text-muted-foreground">
			No tax statements entered for {fyLabel}. Add them from each holding.
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
						<Table.Cell class="font-medium text-primary tabular-nums">{code}</Table.Cell>
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
