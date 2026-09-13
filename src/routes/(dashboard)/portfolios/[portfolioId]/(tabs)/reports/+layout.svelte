<script lang="ts">
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import Button from '$ui/button/button.svelte';
	import * as DropdownMenu from '$ui/dropdown-menu';
	import * as NativeSelect from '$ui/native-select';
	import { Download, ChevronDown } from '@lucide/svelte';
	import { setReportExport } from '#lib/report-export.svelte.js';

	const exporter = setReportExport();
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

	<div class="flex items-center gap-2">
		{#if active?.byYear && years.length > 0}
			<NativeSelect.Root
				value={String(selectedFy)}
				onchange={(e) => goto(`${page.url.pathname}?fy=${e.currentTarget.value}`)}
				class="w-32"
				aria-label="Financial year"
			>
				{#each years as year (year)}
					<NativeSelect.Option value={String(year)}>FY{year}</NativeSelect.Option>
				{/each}
			</NativeSelect.Root>
		{/if}

		{#if active}
			<DropdownMenu.Root>
				<DropdownMenu.Trigger>
					{#snippet child({ props })}
						<Button {...props} variant="ghost">
							<Download class="size-4" />
							Export
							<ChevronDown class="size-3.5" />
						</Button>
					{/snippet}
				</DropdownMenu.Trigger>
				<DropdownMenu.Content align="end">
					<DropdownMenu.Item onSelect={() => window.print()}>PDF</DropdownMenu.Item>
					{#if exporter.csv}
						<DropdownMenu.Item onSelect={() => exporter.csv?.()}>CSV</DropdownMenu.Item>
					{/if}
				</DropdownMenu.Content>
			</DropdownMenu.Root>
		{/if}
	</div>
</div>

{@render children?.()}
