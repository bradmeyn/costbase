<script lang="ts">
	import { page } from '$app/state';
	import * as Table from '$ui/table';
	import { registerReport } from '#lib/report-chrome.svelte.js';
	import { getPortfolioDistributions } from '#lib/remotes/portfolio.remote.js';
	import { formatCurrency, downloadCSV } from '#lib/utils.js';
	import { financialYearStart, financialYearEnd } from '#lib/utils/amit-calculations.js';

	const portfolioId = $derived(page.params.portfolioId!);
	const reportFy = $derived(
		Number(page.url.searchParams.get('fy')) ||
			(new Date().getMonth() >= 6 ? new Date().getFullYear() + 1 : new Date().getFullYear())
	);

	const distributions = $derived(
		await getPortfolioDistributions({ id: portfolioId, financialYear: reportFy })
	);

	const formatDate = (d: Date | string | null) =>
		d
			? new Date(d).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })
			: '—';

	const totals = $derived({
		gross: distributions.reduce((s, d) => s + d.grossPayment, 0),
		withheld: distributions.reduce((s, d) => s + d.taxWithheld, 0),
		net: distributions.reduce((s, d) => s + d.net, 0)
	});

	function generateCsv() {
		let csv = 'Payment date,Record date,Code,Units,Gross,Tax withheld,Net,Reinvested\n';
		for (const d of distributions) {
			csv += `${formatDate(d.datePaid)},${formatDate(d.recordDate)},${d.code},${d.units ?? ''},${(d.grossPayment / 100).toFixed(2)},${(d.taxWithheld / 100).toFixed(2)},${(d.net / 100).toFixed(2)},${d.reinvested ? 'Yes' : 'No'}\n`;
		}
		downloadCSV(csv, `distributions-FY${reportFy}`);
	}

	registerReport(() => ({
		title: 'Distributions',
		subtitle: `${formatDate(financialYearStart(reportFy))} to ${formatDate(financialYearEnd(reportFy))} · cash received, per holding`,
		csv: generateCsv
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
		<p class="text-[13px] text-muted-foreground">No distributions recorded in FY{reportFy}.</p>
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
					<Table.Head>Reinvested</Table.Head>
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
						<Table.Cell class="text-muted-foreground">{d.reinvested ? 'Yes' : 'No'}</Table.Cell>
					</Table.Row>
				{/each}
			</Table.Body>
		</Table.Root>
	</div>
{/if}
