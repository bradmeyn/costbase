<script lang="ts">
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import * as NativeSelect from '$ui/native-select';
	import { getPortfolio, getPortfolios } from '#lib/remotes/portfolio.remote.js';
	import { LayoutGrid, FileText, TrendingUp, Receipt, Coins, Calculator } from '@lucide/svelte';

	let { children } = $props();

	const portfolioId = $derived(page.params.portfolioId!);
	const portfolio = $derived(await getPortfolio(portfolioId));
	const portfolios = $derived(await getPortfolios());

	const groups = $derived([
		{
			heading: 'Portfolio',
			items: [
				{
					href: resolve('/(dashboard)/portfolios/[portfolioId]/(tabs)', { portfolioId }),
					label: 'Overview',
					icon: LayoutGrid,
					ready: true
				}
			]
		},
		{
			heading: 'Reports',
			items: [
				{
					href: resolve('/(dashboard)/portfolios/[portfolioId]/(tabs)/reports/capital-gains', {
						portfolioId
					}),
					label: 'Capital gains',
					icon: FileText,
					ready: true
				},
				{
					href: resolve('/(dashboard)/portfolios/[portfolioId]/(tabs)/reports/unrealised-gains', {
						portfolioId
					}),
					label: 'Unrealised gains',
					icon: TrendingUp,
					ready: true
				},
				{ href: '', label: 'Transactions', icon: Receipt, ready: false },
				{ href: '', label: 'Distributions', icon: Coins, ready: false },
				{ href: '', label: 'AMMA statements', icon: FileText, ready: false }
			]
		},
		{
			heading: 'Tools',
			items: [
				{
					href: resolve('/(dashboard)/portfolios/[portfolioId]/(tabs)/reports/cgt-estimator', {
						portfolioId
					}),
					label: 'CGT estimator',
					icon: Calculator,
					ready: true
				}
			]
		}
	]);

	const current = $derived(page.url.pathname.replace(/\/$/, ''));
</script>

<!--
	Side nav rather than stacked headers: the chrome was taking 254px of vertical on
	an 817px viewport before any data appeared. Vertical is the scarce axis for
	tables; horizontal is not.
-->
<div class="flex gap-6">
	<aside class="w-52 shrink-0 print:hidden">
		<NativeSelect.Root
			value={portfolioId}
			onchange={(e) =>
				goto(
					resolve('/(dashboard)/portfolios/[portfolioId]/(tabs)', {
						portfolioId: e.currentTarget.value
					})
				)}
			aria-label="Portfolio"
		>
			{#each portfolios as p (p.id)}
				<NativeSelect.Option value={p.id}>{p.name}</NativeSelect.Option>
			{/each}
		</NativeSelect.Root>

		<nav class="mt-5 space-y-5">
			{#each groups as group (group.heading)}
				<div>
					<p class="mb-1.5 px-2 text-[11px] font-medium text-muted-foreground">{group.heading}</p>
					<ul class="space-y-0.5">
						{#each group.items as item (item.label)}
							{@const Icon = item.icon}
							<li>
								{#if item.ready}
									<a
										href={item.href}
										class="flex items-center gap-2 rounded-md px-2 py-1.5 text-[13px] transition-colors {current ===
										item.href
											? 'bg-primary/15 font-medium text-foreground'
											: 'text-muted-foreground hover:bg-accent/40 hover:text-foreground'}"
									>
										<Icon class="size-4 shrink-0" />
										{item.label}
									</a>
								{:else}
									<span
										class="flex items-center gap-2 rounded-md px-2 py-1.5 text-[13px] text-muted-foreground/40"
										title="Not built yet"
									>
										<Icon class="size-4 shrink-0" />
										{item.label}
									</span>
								{/if}
							</li>
						{/each}
					</ul>
				</div>
			{/each}
		</nav>
	</aside>

	<div class="min-w-0 flex-1">
		<h1 class="mb-4 hidden text-xl font-semibold print:block">{portfolio.name}</h1>
		{@render children?.()}
	</div>
</div>
