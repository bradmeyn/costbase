<script lang="ts">
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { ArrowRight, CalendarRange } from '@lucide/svelte';

	const portfolioId = $derived(page.params.portfolioId!);

	/*
	  byYear marks a report covering a period, which gets a financial year selector.
	  The others are point-in-time (unrealised gains) or interactive (the estimator).
	*/
	const reports = $derived([
		{
			href: resolve('/(dashboard)/portfolios/[portfolioId]/(tabs)/reports/capital-gains', {
				portfolioId
			}),
			label: 'Capital gains',
			body: 'Realised gains and losses for the year, with 18H and 18A and the trust distribution labels.',
			byYear: true,
			ready: true
		},
		{
			href: resolve('/(dashboard)/portfolios/[portfolioId]/(tabs)/reports/transactions', {
				portfolioId
			}),
			label: 'Transactions',
			body: 'Every buy, sell and reinvestment in the year, with cost base and brokerage.',
			byYear: true,
			ready: true
		},
		{
			href: resolve('/(dashboard)/portfolios/[portfolioId]/(tabs)/reports/distributions', {
				portfolioId
			}),
			label: 'Distributions',
			body: 'Cash distributions received in the year, per holding.',
			byYear: true,
			ready: true
		},
		{
			href: resolve('/(dashboard)/portfolios/[portfolioId]/(tabs)/reports/amma', {
				portfolioId
			}),
			label: 'Tax statements',
			body: 'AMMA attribution components and cost base adjustments, as entered from each annual statement.',
			byYear: true,
			ready: true
		},
		{
			href: resolve('/(dashboard)/portfolios/[portfolioId]/(tabs)/reports/unrealised-gains', {
				portfolioId
			}),
			label: 'Unrealised gains',
			body: 'Open tax lots at today’s prices. A position as it stands, not a period.',
			byYear: false,
			ready: true
		}
	]);

	const tools = $derived([
		{
			href: resolve('/(dashboard)/portfolios/[portfolioId]/(tabs)/reports/cgt-estimator', {
				portfolioId
			}),
			label: 'CGT estimator',
			body: 'Takes the gains already realised this financial year, then models selling more to show the extra assessable income and tax.',
			byYear: false,
			ready: true
		}
	]);
</script>

<svelte:head><title>Reports | Costbase</title></svelte:head>

<h2 class="mb-1 text-base font-semibold">Reports</h2>
<p class="mb-3 text-[11px] text-muted-foreground">
	Period reports carry a financial year selector.
</p>

<div class="mb-8 grid gap-2 md:grid-cols-2">
	{#each reports as report (report.label)}
		{#if report.ready}
			<a
				href={report.href}
				class="group flex items-start justify-between gap-4 rounded-md border border-border bg-card p-4 transition-colors hover:border-primary/40"
			>
				<span class="min-w-0">
					<span class="flex items-center gap-2">
						<span class="text-sm font-medium transition-colors group-hover:text-primary">
							{report.label}
						</span>
						{#if report.byYear}
							<CalendarRange
								class="size-3.5 text-muted-foreground"
								aria-label="Has a financial year"
							/>
						{/if}
					</span>
					<span class="mt-1 block text-[11px] leading-relaxed text-muted-foreground"
						>{report.body}</span
					>
				</span>
				<ArrowRight
					class="mt-0.5 size-4 shrink-0 text-muted-foreground/40 transition-colors group-hover:text-primary"
				/>
			</a>
		{:else}
			<div class="rounded-md border border-dashed border-border p-4 opacity-60">
				<span class="flex items-center gap-2">
					<span class="text-sm font-medium">{report.label}</span>
					{#if report.byYear}
						<CalendarRange class="size-3.5 text-muted-foreground" />
					{/if}
					<span class="ml-auto text-[11px] text-muted-foreground">Not built yet</span>
				</span>
				<span class="mt-1 block text-[11px] leading-relaxed text-muted-foreground"
					>{report.body}</span
				>
			</div>
		{/if}
	{/each}
</div>

<h2 class="mb-3 text-base font-semibold">Tools</h2>

<div class="grid gap-2 md:grid-cols-2">
	{#each tools as tool (tool.label)}
		<a
			href={tool.href}
			class="group flex items-start justify-between gap-4 rounded-md border border-border bg-card p-4 transition-colors hover:border-primary/40"
		>
			<span class="min-w-0">
				<span class="flex items-center gap-2">
					<span class="text-sm font-medium transition-colors group-hover:text-primary">
						{tool.label}
					</span>
					{#if tool.byYear}
						<CalendarRange class="size-3.5 text-muted-foreground" />
					{/if}
				</span>
				<span class="mt-1 block text-[11px] leading-relaxed text-muted-foreground">{tool.body}</span
				>
			</span>
			<ArrowRight
				class="mt-0.5 size-4 shrink-0 text-muted-foreground/40 transition-colors group-hover:text-primary"
			/>
		</a>
	{/each}
</div>
