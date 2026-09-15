<script lang="ts">
	import { page } from '$app/state';
	import * as Table from '$ui/table';
	import { Paperclip } from '@lucide/svelte';
	import { registerReport } from '#lib/report-chrome.svelte.js';
	import {
		getPortfolioTransactions,
		getPortfolioFinancialYears
	} from '#lib/remotes/portfolio.remote.js';
	import { formatCurrency, downloadCSV } from '#lib/utils.js';
	import { describeWindow, readWindow, windowTag } from '#lib/report-period.js';
	import { readList, TRANSACTION_TYPES, UNSET } from '#lib/report-query.js';

	const portfolioId = $derived(page.params.portfolioId!);
	const period = $derived(readWindow(page.url));
	const years = $derived(await getPortfolioFinancialYears(portfolioId));

	const allInPeriod = $derived(await getPortfolioTransactions({ id: portfolioId, ...period }));

	/*
	  Holding and type are applied here rather than in the query: the period has
	  already cut the rows down, and the totals below have to be recomputed from
	  whatever is left anyway.
	*/
	const holdings = $derived(readList(page.url, 'holding'));
	const types = $derived(readList(page.url, 'type'));
	const platforms = $derived(readList(page.url, 'platform'));
	const transactions = $derived(
		allInPeriod
			.filter((t) => holdings.length === 0 || holdings.includes(t.code))
			.filter((t) => types.length === 0 || types.includes(t.type))
			.filter((t) => platforms.length === 0 || platforms.includes(t.platform ?? UNSET))
	);

	/** Says what the filters cut the report down to, when they cut anything. */
	const narrowing = $derived(
		[
			holdings.join(', '),
			types.map((t) => TRANSACTION_TYPES.find((o) => o.value === t)?.label ?? t).join(', '),
			platforms.map((p) => (p === UNSET ? 'No platform' : p)).join(', ')
		]
			.filter(Boolean)
			.join(' · ')
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
		let csv = 'Date,Code,Type,Platform,Quantity,Price per unit,Brokerage,Total,Document\n';
		for (const t of transactions) {
			csv += `${formatDate(t.transactionDate)},${t.code},${t.type},${t.platform ?? ''},${t.quantity},${(t.pricePerUnit / 100).toFixed(2)},${(t.brokerage / 100).toFixed(2)},${(t.total / 100).toFixed(2)},${t.documents.length > 0 ? 'Yes' : 'No'}\n`;
		}
		downloadCSV(
			csv,
			`transactions-${[windowTag(period, years), ...holdings, ...types, ...platforms].join('-')}`
		);
	}

	registerReport(() => ({
		title: 'Transactions',
		subtitle: `${describeWindow(period)} · ${narrowing || 'every buy, sell and reinvestment'}`,
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
		{#if allInPeriod.length > 0}
			No transactions match these filters.
		{:else}
			No transactions {period.from || period.to ? 'in this period' : 'recorded yet'}.
		{/if}
	</div>
{:else}
	<div class="card">
		<Table.Root>
			<Table.Header>
				<Table.Row>
					<Table.Head>Date</Table.Head>
					<Table.Head>Holding</Table.Head>
					<Table.Head>Type</Table.Head>
					<Table.Head>Platform</Table.Head>
					<Table.Head class="text-right">Quantity</Table.Head>
					<Table.Head class="text-right">Price/unit</Table.Head>
					<Table.Head class="text-right">Brokerage</Table.Head>
					<Table.Head class="text-right">Total</Table.Head>
					<Table.Head class="text-center">Document</Table.Head>
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
						<Table.Cell class="text-muted-foreground">{t.platform ?? '—'}</Table.Cell>
						<Table.Cell class="text-right tabular-nums">{t.quantity}</Table.Cell>
						<Table.Cell class="text-right tabular-nums">{formatCurrency(t.pricePerUnit)}</Table.Cell
						>
						<Table.Cell class="text-right tabular-nums">{formatCurrency(t.brokerage)}</Table.Cell>
						<Table.Cell class="text-right tabular-nums">{formatCurrency(t.total)}</Table.Cell>
						<Table.Cell class="text-center">
							{#if t.documents.length > 0}
								<a
									href="/documents/{t.documents[0].id}"
									target="_blank"
									rel="noopener"
									title={t.documents[0].filename}
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
