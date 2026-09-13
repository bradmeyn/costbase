<script lang="ts">
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import Button from '$ui/button/button.svelte';
	import { Printer } from '@lucide/svelte';
	import { getPortfolioFinancialYears } from '#lib/remotes/portfolio.remote.js';

	let { children } = $props();

	const portfolioId = $derived(page.params.portfolioId!);

	const reports = $derived([
		{
			href: resolve('/(dashboard)/portfolios/[portfolioId]/(tabs)/reports/capital-gains', {
				portfolioId
			}),
			label: 'Capital gains',
			byYear: true
		},
		{
			href: resolve('/(dashboard)/portfolios/[portfolioId]/(tabs)/reports/unrealised-gains', {
				portfolioId
			}),
			label: 'Unrealised gains',
			byYear: false
		},
		{
			href: resolve('/(dashboard)/portfolios/[portfolioId]/(tabs)/reports/cgt-estimator', {
				portfolioId
			}),
			label: 'CGT estimator',
			// Always the current year: it asks what selling more would add to what you
			// have already realised, so a past year has nothing to estimate.
			byYear: false
		}
	]);

	const current = $derived(page.url.pathname.replace(/\/$/, ''));
	const active = $derived(reports.find((r) => r.href === current));

	/*
	  The year lives in the URL rather than component state, so a report is linkable
	  and survives a refresh — and the server can filter on it.
	*/
	const years = $derived(await getPortfolioFinancialYears(portfolioId));
	const selectedFy = $derived(Number(page.url.searchParams.get('fy')) || years[0] || null);

	const yearHref = (year: number) => `${page.url.pathname}?fy=${year}`;
</script>

<div class="mb-4 flex flex-wrap items-center justify-between gap-3 print:hidden">
	<div class="flex gap-1">
		{#each reports as report (report.href)}
			<a
				href={report.href}
				class="rounded-md px-2.5 py-1.5 text-[13px] font-medium transition-colors {current ===
				report.href
					? 'bg-primary/15 text-foreground'
					: 'text-muted-foreground hover:text-foreground'}"
			>
				{report.label}
			</a>
		{/each}
	</div>

	<div class="flex items-center gap-3">
		{#if active?.byYear && years.length > 0}
			<div class="flex gap-1">
				{#each years as year (year)}
					<a
						href={yearHref(year)}
						class="rounded-md border px-2.5 py-1 text-[13px] tabular-nums transition-colors {year ===
						selectedFy
							? 'border-primary/30 bg-primary/15 text-foreground'
							: 'border-transparent text-muted-foreground hover:text-foreground'}"
					>
						FY{year}
					</a>
				{/each}
			</div>
		{/if}
		{#if active}
			<Button variant="ghost" onclick={() => window.print()}>
				<Printer class="size-4" />
				Export PDF
			</Button>
		{/if}
	</div>
</div>

{@render children?.()}
