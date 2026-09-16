<script lang="ts">
	import { financialYearLabel, readFinancialYear } from '#lib/report-period.js';
	import { page } from '$app/state';
	import * as Table from '$ui/table';
	import { registerReport } from '#lib/report-chrome.svelte.js';
	import { getPortfolioAmitStatements } from '#lib/remotes/amit.remote.js';
	import { getPortfolio, getPortfolioFinancialYears } from '#lib/remotes/portfolio.remote.js';
	import { netCostBaseAmount } from '#lib/utils/amit-calculations.js';
	import { formatCurrency } from '#lib/utils.js';
	import type { ReportDocument } from '#lib/report-document.js';
	import {
		AMIT_PART_A,
		AMIT_AUSTRALIAN_INCOME,
		AMIT_FRANKED,
		AMIT_CAPITAL_GAINS,
		AMIT_RECONCILIATION
	} from '#lib/schemas/amit.js';

	const portfolioId = $derived(page.params.portfolioId!);
	const all = $derived(await getPortfolioAmitStatements(portfolioId));
	const financialYears = $derived(await getPortfolioFinancialYears(portfolioId));
	const portfolio = $derived(await getPortfolio(portfolioId));
	const reportFy = $derived(readFinancialYear(page.url, financialYears));
	const statements = $derived(all.filter((s) => s.financialYear === reportFy));

	const cents = (s: (typeof statements)[number], field: string) =>
		Number(s[field as keyof typeof s] ?? 0);
	const total = (field: string) => statements.reduce((sum, s) => sum + cents(s, field), 0);

	const adj = $derived(statements.reduce((sum, s) => sum + netCostBaseAmount(s), 0));

	/** Part B groups, rendered the same way; Part A is shown separately with labels. */
	const partB = $derived([
		['Australian income', AMIT_AUSTRALIAN_INCOME],
		['Franked distributions', AMIT_FRANKED],
		['Capital gains', AMIT_CAPITAL_GAINS],
		['Foreign income and reconciliation', AMIT_RECONCILIATION]
	] as const);

	/** One column per statement, plus the total — the same shape as the tables below. */
	const statementColumns = $derived([
		{ header: 'Label' as string, width: 34 },
		{ header: 'Item', width: '*' as const },
		...statements.map((s) => ({ header: s.holdingCode, align: 'right' as const })),
		{ header: 'Total', align: 'right' as const }
	]);

	const amountRow = (field: string, label: string, code = '') => [
		code,
		label,
		...statements.map((s) => formatCurrency(cents(s, field))),
		formatCurrency(total(field))
	];

	function reportDocument(): ReportDocument {
		return {
			title: 'Tax statements',
			portfolioName: portfolio.name,
			subtitle: `Year ended 30 June ${reportFy} · AMIT Member Annual Statement (AMMA), as entered`,
			filename: `amma-${financialYearLabel(reportFy)}`,
			sections: [
				{
					heading: 'Part A — summary of tax return items',
					columns: statementColumns,
					rows: AMIT_PART_A.map(([field, code, label]) => amountRow(field, label, code))
				},
				...partB.map(([heading, rows]) => ({
					heading,
					columns: statementColumns,
					rows: rows.map(([field, label]) => amountRow(field, label))
				}))
			]
		};
	}

	registerReport(() => ({
		title: 'Tax statements',
		subtitle: `Year ended 30 June ${reportFy} · AMIT Member Annual Statement (AMMA), as entered`,
		document: statements.length > 0 ? reportDocument : undefined
	}));
</script>

{#if statements.length === 0}
	<div class="card py-8 text-center">
		<p class="text-[13px] text-muted-foreground">
			No tax statements entered for {financialYearLabel(reportFy)}.
		</p>
		<p class="mt-1 text-[11px] text-muted-foreground">
			Add them from each holding’s tax statements tab.
		</p>
	</div>
{:else}
	<div class="mb-5 grid gap-2 sm:grid-cols-3">
		<div class="rounded-md border border-border bg-card px-3.5 py-3">
			<p class="text-[11px] text-muted-foreground">Cash distribution</p>
			<p class="mt-0.5 text-xl font-semibold tabular-nums">
				{formatCurrency(total('grossCashDistribution'))}
			</p>
		</div>
		<div class="rounded-md border border-border bg-card px-3.5 py-3">
			<p class="text-[11px] text-muted-foreground">Attribution</p>
			<p class="mt-0.5 text-xl font-semibold tabular-nums">
				{formatCurrency(total('grossAttribution'))}
			</p>
		</div>
		<div class="rounded-md border border-border bg-card px-3.5 py-3">
			<p class="text-[11px] text-muted-foreground">Net cost base adjustment</p>
			<p
				class="mt-0.5 text-xl font-semibold tabular-nums {adj === 0
					? ''
					: adj < 0
						? 'text-loss'
						: 'text-gain'}"
			>
				{adj > 0 ? '+' : ''}{formatCurrency(adj)}
			</p>
		</div>
	</div>

	{#snippet amountRows(
		rows: readonly (readonly [string, string] | readonly [string, string, string])[],
		withLabels: boolean
	)}
		{#each rows as row (row[0])}
			{@const field = row[0]}
			<Table.Row>
				{#if withLabels}
					<Table.Cell class="font-medium text-primary tabular-nums">{row[1]}</Table.Cell>
					<Table.Cell class="text-muted-foreground">{row[2]}</Table.Cell>
				{:else}
					<Table.Cell colspan={2} class="text-muted-foreground">{row[1]}</Table.Cell>
				{/if}
				{#each statements as s (s.id)}
					<Table.Cell class="text-right tabular-nums">{formatCurrency(cents(s, field))}</Table.Cell>
				{/each}
				<Table.Cell class="text-right font-medium tabular-nums">
					{formatCurrency(total(field))}
				</Table.Cell>
			</Table.Row>
		{/each}
	{/snippet}

	<section class="card mb-5">
		<h2 class="mb-1 text-base font-semibold">Part A — tax return items</h2>
		<p class="mb-3 text-[11px] text-muted-foreground">
			Totals are what you enter on the supplementary section.
		</p>
		<Table.Root>
			<Table.Header>
				<Table.Row>
					<Table.Head class="w-12">Label</Table.Head>
					<Table.Head>Item</Table.Head>
					{#each statements as s (s.id)}
						<Table.Head class="text-right">{s.holdingCode}</Table.Head>
					{/each}
					<Table.Head class="text-right">Total</Table.Head>
				</Table.Row>
			</Table.Header>
			<Table.Body>{@render amountRows(AMIT_PART_A, true)}</Table.Body>
		</Table.Root>
	</section>

	{#each partB as [heading, rows] (heading)}
		<section class="card mb-5">
			<h2 class="mb-3 text-base font-semibold">Part B — {heading}</h2>
			<Table.Root>
				<Table.Header>
					<Table.Row>
						<Table.Head colspan={2}>Item</Table.Head>
						{#each statements as s (s.id)}
							<Table.Head class="text-right">{s.holdingCode}</Table.Head>
						{/each}
						<Table.Head class="text-right">Total</Table.Head>
					</Table.Row>
				</Table.Header>
				<Table.Body>{@render amountRows(rows, false)}</Table.Body>
			</Table.Root>
		</section>
	{/each}
{/if}
