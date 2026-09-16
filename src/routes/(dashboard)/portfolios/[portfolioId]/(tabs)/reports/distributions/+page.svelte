<script lang="ts">
	import { page } from '$app/state';
	import * as Table from '$ui/table';
	import { CircleCheck, Paperclip } from '@lucide/svelte';
	import { registerReport } from '#lib/report-chrome.svelte.js';
	import {
		getPortfolio,
		getPortfolioDistributions,
		getPortfolioFinancialYears
	} from '#lib/remotes/portfolio.remote.js';
	import { formatCurrency } from '#lib/utils.js';
	import type { ReportDocument } from '#lib/report-document.js';
	import { describeWindow, readWindow, windowTag } from '#lib/report-period.js';
	import { readList } from '#lib/report-query.js';

	const portfolioId = $derived(page.params.portfolioId!);
	const period = $derived(readWindow(page.url));
	const years = $derived(await getPortfolioFinancialYears(portfolioId));
	const portfolio = $derived(await getPortfolio(portfolioId));

	const allInPeriod = $derived(await getPortfolioDistributions({ id: portfolioId, ...period }));

	const holdings = $derived(readList(page.url, 'holding'));
	const distributions = $derived(
		allInPeriod.filter((d) => holdings.length === 0 || holdings.includes(d.code))
	);

	/** Says what the filter cuts the report down to, when it cuts anything. */
	const narrowing = $derived(holdings.join(', '));

	const formatDate = (d: Date | string | null) =>
		d
			? new Date(d).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })
			: '—';

	const totals = $derived({
		gross: distributions.reduce((s, d) => s + d.grossPayment, 0),
		withheld: distributions.reduce((s, d) => s + d.taxWithheld, 0),
		net: distributions.reduce((s, d) => s + d.net, 0)
	});

	function reportDocument(): ReportDocument {
		return {
			title: 'Distributions',
			portfolioName: portfolio.name,
			subtitle: `${describeWindow(period)}${narrowing ? ` · ${narrowing}` : ''}`,
			filename: `distributions-${[windowTag(period, years), ...holdings].join('-')}`,
			sections: [
				{
					columns: [
						{ header: 'Paid' },
						{ header: 'Record date' },
						{ header: 'Code' },
						{ header: 'Units', align: 'right' },
						{ header: 'Gross', align: 'right' },
						{ header: 'Withheld', align: 'right' },
						{ header: 'Net', align: 'right' },
						{ header: 'Reinvested', align: 'center' },
						{ header: 'Document', align: 'center' }
					],
					rows: distributions.map((d) => [
						formatDate(d.datePaid),
						formatDate(d.recordDate),
						d.code,
						d.units?.toLocaleString('en-AU') ?? '',
						formatCurrency(d.grossPayment),
						formatCurrency(d.taxWithheld),
						formatCurrency(d.net),
						d.reinvested ? 'Yes' : 'No',
						d.documents.length > 0 ? 'Yes' : 'No'
					]),
					footer: [
						'Total',
						'',
						'',
						'',
						formatCurrency(totals.gross),
						formatCurrency(totals.withheld),
						formatCurrency(totals.net),
						'',
						''
					]
				}
			],
			notes: [
				'A financial year covers the distributions attributed to it: the June quarter is paid the following July and belongs to the year just ended.'
			]
		};
	}

	registerReport(() => ({
		title: 'Distributions',
		subtitle: `${describeWindow(period)} · ${narrowing || 'cash received, per holding'}`,
		document: reportDocument
	}));
</script>

<div class="mb-5 grid gap-2 sm:grid-cols-3">
	<div class="rounded-md border border-border bg-card px-3.5 py-3">
		<p class="text-[11px] text-muted-foreground">Gross</p>
		<p class="mt-0.5 text-xl font-semibold tabular-nums">{formatCurrency(totals.gross)}</p>
	</div>
	<div class="rounded-md border border-border bg-card px-3.5 py-3">
		<p class="text-[11px] text-muted-foreground">Tax withheld</p>
		<p class="mt-0.5 text-xl font-semibold tabular-nums">{formatCurrency(totals.withheld)}</p>
	</div>
	<div class="rounded-md border border-border bg-card px-3.5 py-3">
		<p class="text-[11px] text-muted-foreground">Net received</p>
		<p class="mt-0.5 text-xl font-semibold tabular-nums">{formatCurrency(totals.net)}</p>
	</div>
</div>

{#if distributions.length === 0}
	<div class="card py-8 text-center">
		<p class="text-[13px] text-muted-foreground">
			{#if allInPeriod.length > 0}
				No distributions match these filters.
			{:else}
				No distributions {period.from || period.to ? 'in this period' : 'recorded yet'}.
			{/if}
		</p>
		<p class="mt-1 text-[11px] text-muted-foreground">
			Add them from a holding, or import a distribution statement.
		</p>
	</div>
{:else}
	<div class="card">
		<Table.Root>
			<Table.Header>
				<Table.Row>
					<Table.Head>Paid</Table.Head>
					<Table.Head>Record date</Table.Head>
					<Table.Head>Holding</Table.Head>
					<Table.Head class="text-right">Units</Table.Head>
					<Table.Head class="text-right">Gross</Table.Head>
					<Table.Head class="text-right">Withheld</Table.Head>
					<Table.Head class="text-right">Net</Table.Head>
					<Table.Head class="text-center">Reinvested</Table.Head>
					<Table.Head class="text-center">Document</Table.Head>
				</Table.Row>
			</Table.Header>
			<Table.Body>
				{#each distributions as d (d.id)}
					<Table.Row>
						<Table.Cell>{formatDate(d.datePaid)}</Table.Cell>
						<Table.Cell class="text-muted-foreground">{formatDate(d.recordDate)}</Table.Cell>
						<Table.Cell class="font-medium">{d.code}</Table.Cell>
						<Table.Cell class="text-right tabular-nums">{d.units ?? '—'}</Table.Cell>
						<Table.Cell class="text-right tabular-nums">{formatCurrency(d.grossPayment)}</Table.Cell
						>
						<Table.Cell class="text-right tabular-nums">{formatCurrency(d.taxWithheld)}</Table.Cell>
						<Table.Cell class="text-right tabular-nums">{formatCurrency(d.net)}</Table.Cell>
						<!--
							The same tick as the holding's own tab: a column of Yes/No reads as text to
							be parsed, where a row of ticks can be scanned. The CSV keeps Yes/No, which
							is what a spreadsheet can filter on.
						-->
						<Table.Cell class="text-center">
							<CircleCheck
								class="inline size-4 {d.reinvested
									? 'text-gain'
									: 'text-muted-foreground opacity-25'}"
								aria-label={d.reinvested ? 'Reinvested' : 'Paid in cash'}
							/>
						</Table.Cell>
						<Table.Cell class="text-center">
							{#if d.documents.length > 0}
								<a
									href="/documents/{d.documents[0].id}"
									target="_blank"
									rel="noopener"
									title={d.documents[0].filename}
									class="inline-flex text-primary hover:text-primary/80"
								>
									<Paperclip class="size-4" />
								</a>
							{:else}
								<Paperclip class="inline size-4 text-muted-foreground/25" />
							{/if}
						</Table.Cell>
					</Table.Row>
				{/each}
			</Table.Body>
		</Table.Root>
	</div>
{/if}
