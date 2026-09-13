<script lang="ts">
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { getPortfolio } from '#lib/remotes/portfolio.remote.js';
	import { ArrowLeft } from '@lucide/svelte';

	let { children } = $props();

	const portfolioId = $derived(page.params.portfolioId!);
	const portfolio = $derived(await getPortfolio(portfolioId));

	const tabs = $derived([
		{
			href: resolve('/(dashboard)/portfolios/[portfolioId]/(tabs)', { portfolioId }),
			label: 'Holdings',
			match: (p: string) =>
				p === resolve('/(dashboard)/portfolios/[portfolioId]/(tabs)', { portfolioId })
		},
		{
			href: resolve('/(dashboard)/portfolios/[portfolioId]/(tabs)/reports/capital-gains', {
				portfolioId
			}),
			label: 'Reports',
			match: (p: string) => p.includes('/reports/')
		},
		{
			href: resolve('/(dashboard)/portfolios/[portfolioId]/(tabs)/cgt-estimator', { portfolioId }),
			label: 'CGT Estimator',
			match: (p: string) => p.endsWith('/cgt-estimator')
		}
	]);

	const current = $derived(page.url.pathname.replace(/\/$/, ''));
</script>

<!-- Chrome lives here so every tab gets the same header, back link and tabs. -->
<div class="print:hidden">
	<a
		href={resolve('/(dashboard)/portfolios')}
		class="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
	>
		<ArrowLeft class="size-4" />
		Back to Portfolios
	</a>

	<h1 class="heading-primary mt-4">{portfolio.name}</h1>

	<div class="mb-5 flex gap-1 border-b">
		{#each tabs as tab (tab.href)}
			<a
				href={tab.href}
				class="border-b-2 px-3 py-2 text-sm font-medium transition-colors {tab.match(current)
					? 'border-primary text-primary'
					: 'border-transparent text-muted-foreground hover:text-foreground'}"
			>
				{tab.label}
			</a>
		{/each}
	</div>
</div>

{@render children?.()}
