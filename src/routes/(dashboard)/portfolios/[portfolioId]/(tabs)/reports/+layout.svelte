<script lang="ts">
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import Button from '$ui/button/button.svelte';
	import * as DropdownMenu from '$ui/dropdown-menu';
	import * as Select from '$ui/select';
	import { Download, ChevronDown } from '@lucide/svelte';
	import { setReportChrome } from '#lib/report-chrome.svelte.js';
	import ReportPeriodSelect from '#lib/components/report-period-select.svelte';
	import ReportFilterMenu from '#lib/components/report-filter-menu.svelte';
	import { TRANSACTION_TYPES } from '#lib/report-query.js';
	import { financialYearLabel, readFinancialYear } from '#lib/report-period.js';

	const chrome = setReportChrome();
	import { getPortfolio, getPortfolioFinancialYears } from '#lib/remotes/portfolio.remote.js';

	let { children } = $props();

	const portfolioId = $derived(page.params.portfolioId!);

	const reports = $derived([
		{
			href: resolve('/(dashboard)/portfolios/[portfolioId]/(tabs)/reports/capital-gains', {
				portfolioId
			}),
			label: 'Capital gains',
			// A tax return is filed for a financial year, so this one has no other span,
			// and no holding filter: the totals are the return, not a selection of it.
			period: 'financial-year',
			filters: {}
		},
		{
			href: resolve('/(dashboard)/portfolios/[portfolioId]/(tabs)/reports/transactions', {
				portfolioId
			}),
			label: 'Transactions',
			// A record of activity, not a return: all of it by default, narrowed on demand.
			period: 'range',
			filters: { holdings: true, types: true }
		},
		{
			href: resolve('/(dashboard)/portfolios/[portfolioId]/(tabs)/reports/distributions', {
				portfolioId
			}),
			label: 'Distributions',
			period: 'range',
			filters: { holdings: true }
		},
		{
			href: resolve('/(dashboard)/portfolios/[portfolioId]/(tabs)/reports/amma', { portfolioId }),
			label: 'AMMA statements',
			period: 'financial-year',
			filters: {}
		},
		{
			href: resolve('/(dashboard)/portfolios/[portfolioId]/(tabs)/reports/unrealised-gains', {
				portfolioId
			}),
			label: 'Unrealised gains',
			period: 'none',
			filters: { holdings: true }
		},
		{
			href: resolve('/(dashboard)/portfolios/[portfolioId]/(tabs)/reports/cgt-estimator', {
				portfolioId
			}),
			label: 'CGT estimator',
			// Always the current year: it asks what selling more would add to what you
			// have already realised, so a past year has nothing to estimate.
			period: 'none',
			filters: {}
		}
	]);

	const current = $derived(page.url.pathname.replace(/\/$/, ''));
	const active = $derived(reports.find((r) => r.href === current));

	/*
	  The year lives in the URL rather than component state, so a report is linkable
	  and survives a refresh — and the server can filter on it.
	*/
	const years = $derived(await getPortfolioFinancialYears(portfolioId));
	const selectedFy = $derived(readFinancialYear(page.url, years));

	/* Holdings are named by their ticker in the query, so the link stays readable. */
	const portfolio = $derived(await getPortfolio(portfolioId));
	const holdingOptions = $derived(
		portfolio.holdings
			.map((h) => ({ value: h.investment.code, label: h.investment.code }))
			.sort((a, b) => a.label.localeCompare(b.label))
	);
</script>

<div class="mb-5 flex flex-wrap items-start justify-between gap-3">
	<div class="min-w-0">
		<h1 class="text-2xl font-semibold tracking-tight">{chrome.title}</h1>
		{#if chrome.subtitle}
			<p class="mt-1 text-[13px] text-muted-foreground">{chrome.subtitle}</p>
		{/if}
	</div>
	<div class="print:hidden">
		<div class="flex items-center gap-2">
			{#if active?.period === 'financial-year' && years.length > 0}
				<Select.Root
					type="single"
					value={String(selectedFy)}
					onValueChange={(v) => v && goto(`${page.url.pathname}?fy=${v}`)}
				>
					<Select.Trigger class="w-28" aria-label="Financial year">
						{financialYearLabel(selectedFy)}
					</Select.Trigger>
					<Select.Content>
						{#each years as year (year)}
							<Select.Item value={String(year)}>{financialYearLabel(year)}</Select.Item>
						{/each}
					</Select.Content>
				</Select.Root>
			{:else if active?.period === 'range'}
				<ReportPeriodSelect {years} />
			{/if}

			{#if active?.filters?.holdings && holdingOptions.length > 1}
				<ReportFilterMenu
					param="holding"
					options={holdingOptions}
					allLabel="All holdings"
					noun="holdings"
				/>
			{/if}

			{#if active?.filters?.types}
				<ReportFilterMenu
					param="type"
					options={TRANSACTION_TYPES}
					allLabel="All types"
					noun="types"
				/>
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
						{#if chrome.csv}
							<DropdownMenu.Item onSelect={() => chrome.csv?.()}>CSV</DropdownMenu.Item>
						{/if}
					</DropdownMenu.Content>
				</DropdownMenu.Root>
			{/if}
		</div>
	</div>
</div>

{@render children?.()}
