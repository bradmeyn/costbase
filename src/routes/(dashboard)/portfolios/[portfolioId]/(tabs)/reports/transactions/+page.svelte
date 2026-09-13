<script lang="ts">
	import { page } from '$app/state';
	import * as Table from '$ui/table';
	import { registerReport } from '#lib/report-chrome.svelte.js';
	import { getPortfolioTransactions } from '#lib/remotes/portfolio.remote.js';
	import { formatCurrency, downloadCSV } from '#lib/utils.js';
	import { financialYearStart, financialYearEnd } from '#lib/utils/amit-calculations.js';

	const portfolioId = $derived(page.params.portfolioId!);
	const reportFy = $derived(
		Number(page.url.searchParams.get('fy')) ||
			(new Date().getMonth() >= 6 ? new Date().getFullYear() + 1 : new Date().getFullYear())
	);

	const transactions = $derived(
		await getPortfolioTransactions({ id: portfolioId, financialYear: reportFy })
	);

	const formatDate = (d: Date | string) =>
		new Date(d).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' });

	const totals = $derived({
		brokerage: transactions.reduce((s, t) => s + t.brokerage, 0),
		bought: transactions.filter((t) => t.type !== 'sell').reduce((s, t) => s + t.total, 0),
		sold: transactions.filter((t) => t.type === 'sell').reduce((s, t) => s + t.total, 0)
	});

	const TYPES: Record<string, { label: string; dot: string }> = {
		buy: { label: 'Buy', dot: 'bg-gain' },
		sell: { label: 'Sell', dot: 'bg-loss' },
		reinvestment: { label: 'Reinvestment', dot: 'bg-primary' }
	};

	function generateCsv() {
		let csv = 'Date,Code,Type,Quantity,Price per unit,Brokerage,Total\n';
		for (const t of transactions) {
			csv += `${formatDate(t.transactionDate)},${t.code},${t.type},${t.quantity},${(t.pricePerUnit / 100).toFixed(2)},${(t.brokerage / 100).toFixed(2)},${(t.total / 100).toFixed(2)}\n`;
		}
		downloadCSV(csv, `transactions-FY${reportFy}`);
	}

	registerReport(() => ({
		title: 'Transactions',
		subtitle: `${formatDate(financialYearStart(reportFy))} to ${formatDate(financialYearEnd(reportFy))} · every buy, sell and reinvestment`,
		csv: generateCsv
	}));
</script>

<div class="mb-5 grid gap-2 sm:grid-cols-3">
	<div class="rounded-md border border-border bg-card px-3.5 py-3">
		<p class="text-[11px] text-muted-foreground">Acquired</p>
		<p class="mt-0.5 text-xl font-semibold tabular-nums">{formatCurrency(totals.bought)}</p>
	</div>
	<div class="rounded-md border border-border bg-card px-3.5 py-3">
		<p class="text-[11px] text-muted-foreground">Disposed</p>
		<p class="mt-0.5 text-xl font-semibold tabular-nums">{formatCurrency(totals.sold)}</p>
	</div>
	<div class="rounded-md border border-border bg-card px-3.5 py-3">
		<p class="text-[11px] text-muted-foreground">Brokerage</p>
		<p class="mt-0.5 text-xl font-semibold tabular-nums">{formatCurrency(totals.brokerage)}</p>
	</div>
</div>

{#if transactions.length === 0}
	<div class="card py-8 text-center text-[13px] text-muted-foreground">
		No transactions in FY{reportFy}.
	</div>
{:else}
	<div class="card">
		<Table.Root>
			<Table.Header>
				<Table.Row>
					<Table.Head>Date</Table.Head>
					<Table.Head>Holding</Table.Head>
					<Table.Head>Type</Table.Head>
					<Table.Head class="text-right">Quantity</Table.Head>
					<Table.Head class="text-right">Price/unit</Table.Head>
					<Table.Head class="text-right">Brokerage</Table.Head>
					<Table.Head class="text-right">Total</Table.Head>
				</Table.Row>
			</Table.Header>
			<Table.Body>
				{#each transactions as t (t.id)}
					{@const type = TYPES[t.type] ?? { label: t.type, dot: 'bg-muted-foreground' }}
					<Table.Row>
						<Table.Cell>{formatDate(t.transactionDate)}</Table.Cell>
						<Table.Cell class="font-medium">{t.code}</Table.Cell>
						<Table.Cell>
							<span class="inline-flex items-center gap-2">
								<span class="size-1.5 rounded-full {type.dot}"></span>
								{type.label}
							</span>
						</Table.Cell>
						<Table.Cell class="text-right tabular-nums">{t.quantity}</Table.Cell>
						<Table.Cell class="text-right tabular-nums">{formatCurrency(t.pricePerUnit)}</Table.Cell
						>
						<Table.Cell class="text-right tabular-nums">{formatCurrency(t.brokerage)}</Table.Cell>
						<Table.Cell class="text-right tabular-nums">{formatCurrency(t.total)}</Table.Cell>
					</Table.Row>
				{/each}
			</Table.Body>
		</Table.Root>
	</div>
{/if}
