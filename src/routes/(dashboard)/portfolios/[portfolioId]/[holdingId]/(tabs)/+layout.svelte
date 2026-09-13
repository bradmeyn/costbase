<script lang="ts">
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { getHolding } from '#lib/remotes/holding.remote.js';
	import SummaryCard from '#lib/components/summary-card.svelte';
	import { ArrowLeft } from '@lucide/svelte';
	import { formatCurrency } from '#lib/utils.js';

	let { children } = $props();

	const holdingId = $derived(page.params.holdingId!);
	const portfolioId = $derived(page.params.portfolioId!);
	const holding = $derived(await getHolding(holdingId));

	const base = $derived(`/portfolios/${portfolioId}/${holdingId}`);
	const tabs = $derived([
		{ href: base, label: 'Transactions' },
		{ href: `${base}/distributions`, label: 'Distributions' },
		{ href: `${base}/tax-statements`, label: 'Tax statements' }
	]);
	const current = $derived(page.url.pathname.replace(/\/$/, ''));
</script>

<div>
	<a
		href={resolve('/(dashboard)/portfolios/[portfolioId]/(tabs)', { portfolioId })}
		class="mb-4 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
	>
		<ArrowLeft class="size-4" />
		Back to Portfolio
	</a>
	<div class="mt-4">
		<h1 class="heading-primary">{holding.investment.name}</h1>
		<p class="text-lg text-muted-foreground">{holding.investment.code}</p>
	</div>
</div>

<!-- Holding summary -->
<div class="mb-5 grid gap-2 sm:grid-cols-3 lg:grid-cols-6">
	<SummaryCard label="Units" value={String(holding.units || 0)} />
	<SummaryCard
		label="Avg. price"
		value={holding.averagePrice ? formatCurrency(holding.averagePrice) : '$0.00'}
	/>
	<SummaryCard label="Cost base" value={formatCurrency(holding.costBase)} />
	<SummaryCard label="Current price" value={formatCurrency(holding.currentPrice)} />
	<SummaryCard label="Current value" value={formatCurrency(holding.currentValue)} />
	<SummaryCard
		label="Unrealised gain"
		value={formatCurrency(holding.unrealisedGain)}
		valueClass={holding.unrealisedGain >= 0 ? 'text-gain' : 'text-loss'}
	>
		<p
			class="mt-1 text-sm font-medium {holding.unrealisedGainPercent >= 0
				? 'text-gain'
				: 'text-loss'}"
		>
			{holding.unrealisedGainPercent >= 0 ? '+' : ''}{holding.unrealisedGainPercent.toFixed(2)}%
		</p>
	</SummaryCard>
</div>

<div class="mb-5 flex gap-1 border-b">
	{#each tabs as tab (tab.href)}
		<a
			href={tab.href}
			class="border-b-2 px-3 py-2 text-sm font-medium transition-colors {current === tab.href
				? 'border-primary text-primary'
				: 'border-transparent text-muted-foreground hover:text-foreground'}"
		>
			{tab.label}
		</a>
	{/each}
</div>

{@render children?.()}
