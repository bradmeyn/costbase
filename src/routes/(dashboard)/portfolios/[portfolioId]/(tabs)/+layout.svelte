<script lang="ts">
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { getPortfolio } from '#lib/remotes/portfolio.remote.js';
	import { ArrowLeft, FileText } from '@lucide/svelte';

	let { children } = $props();

	const portfolioId = $derived(page.params.portfolioId!);
	const portfolio = $derived(await getPortfolio(portfolioId));

	/* Holdings is not listed: /portfolios/[id] is the holdings view, so a tab
	   pointing at the page you are already on would be noise. */
	const sections = $derived([
		{
			href: resolve('/(dashboard)/portfolios/[portfolioId]/(tabs)/reports', { portfolioId }),
			label: 'Reports',
			icon: FileText,
			match: (p: string) => p.includes('/reports')
		}
	]);

	const current = $derived(page.url.pathname.replace(/\/$/, ''));
	const onHoldings = $derived(!sections.some((s) => s.match(current)));
</script>

<div class="print:hidden">
	<a
		href={onHoldings
			? resolve('/(dashboard)/portfolios')
			: resolve('/(dashboard)/portfolios/[portfolioId]/(tabs)', { portfolioId })}
		class="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
	>
		<ArrowLeft class="size-4" />
		{onHoldings ? 'Back to Portfolios' : `Back to ${portfolio.name}`}
	</a>

	<div class="mt-4 mb-5 flex flex-wrap items-center justify-between gap-3 border-b pb-3">
		<h1 class="heading-primary mb-0">{portfolio.name}</h1>

		<div class="flex gap-1">
			{#each sections as section (section.href)}
				{@const Icon = section.icon}
				<a
					href={section.href}
					class="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[13px] font-medium transition-colors {section.match(
						current
					)
						? 'bg-primary/15 text-foreground'
						: 'text-muted-foreground hover:text-foreground'}"
				>
					<Icon class="size-4" />
					{section.label}
				</a>
			{/each}
		</div>
	</div>
</div>

{@render children?.()}
