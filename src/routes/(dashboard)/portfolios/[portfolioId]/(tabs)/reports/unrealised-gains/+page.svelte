<script lang="ts">
	import { registerReport } from '#lib/report-chrome.svelte.js';
	import { getPortfolioUnrealisedGains } from '#lib/remotes/portfolio.remote.js';
	import { page } from '$app/state';
	import * as Table from '$ui/table';
	import { formatCurrency, downloadCSV } from '#lib/utils.js';
	import SummaryCard from '#lib/components/summary-card.svelte';
	import { readList } from '#lib/report-query.js';

	const portfolioId = page.params.portfolioId!;
	const all = $derived(await getPortfolioUnrealisedGains(portfolioId));

	/* Narrowed here, not in the query: every total below is recomputed from the rows. */
	const chosen = $derived(readList(page.url, 'holding'));
	const keep = (code: string) => chosen.length === 0 || chosen.includes(code);
	const data = $derived({
		holdings: all.holdings.filter((h) => keep(h.code)),
		unrealisedLots: all.unrealisedLots.filter((lot) => keep(lot.holdingCode))
	});

	const formatDate = (date: Date | string) => {
		return new Date(date).toLocaleDateString('en-AU', {
			year: 'numeric',
			month: 'short',
			day: 'numeric'
		});
	};

	const totalUnrealisedGain = $derived(data.holdings.reduce((sum, h) => sum + h.unrealisedGain, 0));

	const sortedLots = $derived(
		[...data.unrealisedLots].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
	);

	const longTermLots = $derived(data.unrealisedLots.filter((lot) => lot.isLongTerm));
	const shortTermLots = $derived(data.unrealisedLots.filter((lot) => !lot.isLongTerm));

	const byDate = (a: { date: Date | string }, b: { date: Date | string }) =>
		new Date(a.date).getTime() - new Date(b.date).getTime();
	const longTermSorted = $derived([...longTermLots].sort(byDate));
	const shortTermSorted = $derived([...shortTermLots].sort(byDate));

	const totalLongTermGain = $derived(
		longTermLots.reduce((sum, lot) => sum + lot.unrealisedGain, 0)
	);
	const totalShortTermGain = $derived(
		shortTermLots.reduce((sum, lot) => sum + lot.unrealisedGain, 0)
	);

	function generateUnrealisedGainsReport() {
		let csv = 'Unrealised Gains Report\n\n';

		// Summary
		csv += 'Summary\n';
		csv += 'Category,Amount\n';
		csv += `Total Unrealised Gain,${(totalUnrealisedGain / 100).toFixed(2)}\n`;
		csv += `Long-Term Unrealised Gain,${(totalLongTermGain / 100).toFixed(2)}\n`;
		csv += `Short-Term Unrealised Gain,${(totalShortTermGain / 100).toFixed(2)}\n\n`;

		// All Unrealised Lots
		csv += 'Unrealised Tax Lots (FIFO)\n';
		csv +=
			'Holding,Code,Purchase Date,Units,Cost/Unit,Current Price,Unrealised Gain,Discount Eligible\n';
		sortedLots.forEach((lot) => {
			csv += `${lot.holdingName},${lot.holdingCode},${formatDate(lot.date)},${lot.quantity},${(lot.costPerUnit / 100).toFixed(2)},${(lot.currentPrice / 100).toFixed(2)},${(lot.unrealisedGain / 100).toFixed(2)},${lot.isLongTerm ? 'Yes' : 'No'}\n`;
		});

		downloadCSV(csv, 'Unrealised-Gains-Report');
	}

	registerReport(() => ({
		title: 'Unrealised gains',
		subtitle: `Open tax lots at today’s prices · first in, first out${chosen.length > 0 ? ` · ${chosen.join(', ')}` : ''}`,
		csv: generateUnrealisedGainsReport
	}));
</script>

<!-- Summary Cards -->
<div class="mb-8 grid gap-4 md:grid-cols-3">
	<SummaryCard
		label="Total unrealised gain"
		value={formatCurrency(totalUnrealisedGain)}
		valueClass={totalUnrealisedGain >= 0 ? '' : 'text-loss'}
	/>
	<SummaryCard
		label="Long-term unrealised gain"
		value={formatCurrency(totalLongTermGain)}
		valueClass={totalLongTermGain >= 0 ? '' : 'text-loss'}
	>
		<p class="mt-1 text-xs text-muted-foreground">Held &gt; 12 months (50% discount eligible)</p>
	</SummaryCard>
	<SummaryCard
		label="Short-term unrealised gain"
		value={formatCurrency(totalShortTermGain)}
		valueClass={totalShortTermGain >= 0 ? '' : 'text-loss'}
	>
		<p class="mt-1 text-xs text-muted-foreground">Held ≤ 12 months</p>
	</SummaryCard>
</div>

<!--
	Split by discount status rather than carrying a status column: whether a parcel
	has passed twelve months is the thing that changes the tax, so it groups the rows
	instead of annotating them.
-->
{#snippet lotsTable(lots: typeof sortedLots, total: number)}
	<Table.Root>
		<Table.Header>
			<Table.Row>
				<Table.Head>Holding</Table.Head>
				<Table.Head>Purchase date</Table.Head>
				<Table.Head class="text-right">Units</Table.Head>
				<Table.Head class="text-right">Cost/unit</Table.Head>
				<Table.Head class="text-right">Current price</Table.Head>
				<Table.Head class="text-right">Unrealised gain</Table.Head>
			</Table.Row>
		</Table.Header>
		<Table.Body>
			{#each lots as lot, i (i)}
				<Table.Row>
					<Table.Cell class="font-medium">{lot.holdingCode}</Table.Cell>
					<Table.Cell>{formatDate(lot.date)}</Table.Cell>
					<Table.Cell class="text-right">{lot.quantity}</Table.Cell>
					<Table.Cell class="text-right">{formatCurrency(lot.costPerUnit)}</Table.Cell>
					<Table.Cell class="text-right">{formatCurrency(lot.currentPrice)}</Table.Cell>
					<Table.Cell class="text-right {lot.unrealisedGain >= 0 ? '' : 'text-loss'}">
						{formatCurrency(lot.unrealisedGain)}
					</Table.Cell>
				</Table.Row>
			{/each}
		</Table.Body>
		<Table.Footer>
			<Table.Row>
				<Table.Cell colspan={5} class="font-medium">Subtotal</Table.Cell>
				<Table.Cell class="text-right font-semibold {total >= 0 ? '' : 'text-loss'}">
					{formatCurrency(total)}
				</Table.Cell>
			</Table.Row>
		</Table.Footer>
	</Table.Root>
{/snippet}

{#if data.unrealisedLots.length === 0}
	<div class="card mb-8 py-8 text-center text-muted-foreground">
		No unrealised tax lots. Add transactions to see your tax lot breakdown.
	</div>
{:else}
	<section class="mb-6">
		<div class="mb-2 flex items-baseline gap-2">
			<h2 class="text-base font-semibold">Discount eligible</h2>
			<span class="text-[11px] text-muted-foreground">
				Held over 12 months · 50% CGT discount applies
			</span>
		</div>
		<div class="card">
			{#if longTermSorted.length > 0}
				{@render lotsTable(longTermSorted, totalLongTermGain)}
			{:else}
				<p class="py-6 text-center text-[13px] text-muted-foreground">
					No parcels have passed twelve months yet.
				</p>
			{/if}
		</div>
	</section>

	<section class="mb-8">
		<div class="mb-2 flex items-baseline gap-2">
			<h2 class="text-base font-semibold">Not yet eligible</h2>
			<span class="text-[11px] text-muted-foreground">Held 12 months or less</span>
		</div>
		<div class="card">
			{#if shortTermSorted.length > 0}
				{@render lotsTable(shortTermSorted, totalShortTermGain)}
			{:else}
				<p class="py-6 text-center text-[13px] text-muted-foreground">
					Every parcel has passed twelve months.
				</p>
			{/if}
		</div>
	</section>
{/if}

<!-- Holdings Summary -->
<div class="mb-8">
	<h2 class="mb-3 text-base font-semibold">Holdings Summary</h2>
	{#if data.holdings.length > 0}
		<div class="card">
			<Table.Root>
				<Table.Header>
					<Table.Row>
						<Table.Head>Holding</Table.Head>
						<Table.Head class="text-right">Units</Table.Head>
						<Table.Head class="text-right">Current Price</Table.Head>
						<Table.Head class="text-right">Current Value</Table.Head>
						<Table.Head class="text-right">Unrealised Gain</Table.Head>
					</Table.Row>
				</Table.Header>
				<Table.Body>
					{#each data.holdings as holding (holding.id)}
						<Table.Row>
							<Table.Cell class="font-medium">{holding.name} ({holding.code})</Table.Cell>
							<Table.Cell class="text-right">{holding.units}</Table.Cell>
							<Table.Cell class="text-right">{formatCurrency(holding.currentPrice)}</Table.Cell>
							<Table.Cell class="text-right">{formatCurrency(holding.currentValue)}</Table.Cell>
							<Table.Cell class="text-right {holding.unrealisedGain >= 0 ? '' : 'text-loss'}">
								{formatCurrency(holding.unrealisedGain)}
							</Table.Cell>
						</Table.Row>
					{/each}
				</Table.Body>
				<Table.Footer>
					<Table.Row>
						<Table.Cell colspan={3} class="font-medium">Total</Table.Cell>
						<Table.Cell class="text-right font-bold">
							{formatCurrency(data.holdings.reduce((sum, h) => sum + h.currentValue, 0))}
						</Table.Cell>
						<Table.Cell class="text-right font-bold {totalUnrealisedGain >= 0 ? '' : 'text-loss'}">
							{formatCurrency(totalUnrealisedGain)}
						</Table.Cell>
					</Table.Row>
				</Table.Footer>
			</Table.Root>
		</div>
	{:else}
		<div class="card py-8 text-center text-muted-foreground">No holdings found.</div>
	{/if}
</div>
