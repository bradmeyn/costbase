<script lang="ts">
	import { getPortfolioUnrealisedGains } from '#lib/remotes/portfolio.remote.js';
	import { page } from '$app/state';
	import * as Table from '$ui/table';
	import Button from '$ui/button/button.svelte';
	import { formatCurrency, downloadCSV } from '#lib/utils.js';
	import SummaryCard from '#lib/components/summary-card.svelte';
	import { Check, Download, Minus } from '@lucide/svelte';

	const portfolioId = page.params.portfolioId!;
	const data = $derived(await getPortfolioUnrealisedGains(portfolioId));

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
</script>

<div class="mb-4 flex items-center gap-3">
	<a href="/dashboard/portfolios" class="text-sm text-muted-foreground hover:text-foreground"
		>← Portfolios</a
	>
	<span class="text-muted-foreground">/</span>
	<a
		href="/dashboard/portfolios/{portfolioId}"
		class="text-sm text-muted-foreground hover:text-foreground">Holdings</a
	>
</div>

<div class="mb-6 flex items-center justify-between">
	<div class="mr-4 flex flex-1 gap-1 border-b">
		<a
			href="/dashboard/portfolios/{portfolioId}"
			class="border-b-2 border-transparent px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground"
			>Holdings</a
		>
		<a
			href="/dashboard/portfolios/{portfolioId}/reports/unrealised-gains"
			class="border-b-2 border-primary px-3 py-2 text-sm font-medium text-primary"
			>Unrealised Gains</a
		>
		<a
			href="/dashboard/portfolios/{portfolioId}/reports/cgt"
			class="border-b-2 border-transparent px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground"
			>CGT Report</a
		>
	</div>
	<Button onclick={generateUnrealisedGainsReport}>
		<Download class="size-4" />
		<span>Download</span>
	</Button>
</div>

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

<!-- Unrealised Tax Lots -->
<div class="mb-8">
	<h2 class="mb-3 text-base font-semibold">Unrealised Tax Lots (FIFO)</h2>
	<p class="mb-4 text-muted-foreground">
		Your current holdings broken down by purchase date for CGT purposes.
	</p>

	{#if data.unrealisedLots.length > 0}
		<div class="card">
			<Table.Root>
				<Table.Header>
					<Table.Row>
						<Table.Head>Holding</Table.Head>
						<Table.Head>Purchase Date</Table.Head>
						<Table.Head class="text-right">Units</Table.Head>
						<Table.Head class="text-right">Cost/Unit</Table.Head>
						<Table.Head class="text-right">Current Price</Table.Head>
						<Table.Head class="text-right">Unrealised Gain</Table.Head>
						<Table.Head>Discount Status</Table.Head>
					</Table.Row>
				</Table.Header>
				<Table.Body>
					{#each sortedLots as lot, i (i)}
						<Table.Row>
							<Table.Cell class="font-medium">{lot.holdingName} ({lot.holdingCode})</Table.Cell>
							<Table.Cell>{formatDate(lot.date)}</Table.Cell>
							<Table.Cell class="text-right">{lot.quantity}</Table.Cell>
							<Table.Cell class="text-right">{formatCurrency(lot.costPerUnit)}</Table.Cell>
							<Table.Cell class="text-right">{formatCurrency(lot.currentPrice)}</Table.Cell>
							<Table.Cell class="text-right {lot.unrealisedGain >= 0 ? '' : 'text-loss'}">
								{formatCurrency(lot.unrealisedGain)}
							</Table.Cell>
							<Table.Cell class="text-center">
								{#if lot.isLongTerm}
									<span class=" size-4 rounded-full bg-gain/20 p-2 text-xs"
										><Check class="inline-block size-4 " /></span
									>
								{:else}
									<span class="rounded px-2 py-1 text-xs text-brand-2"
										><Minus class="inline-block size-4" /></span
									>
								{/if}
							</Table.Cell>
						</Table.Row>
					{/each}
				</Table.Body>
			</Table.Root>
		</div>
	{:else}
		<div class="card py-8 text-center text-muted-foreground">
			No unrealised tax lots. Add transactions to see your tax lot breakdown.
		</div>
	{/if}
</div>

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
