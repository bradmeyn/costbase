<script lang="ts">
	import { setCalculatorState, getCalculatorState } from './calculator.svelte';
	import * as Tabs from '#lib/components/ui/tabs/index.js';
	import { formatCurrency, formatPercentage } from '#lib/utils/formatters.js';
	import Inputs from './_components/tax-inputs.svelte';
	import TaxBreakdown from './_components/tax-breakdown.svelte';
	import ScrollableTable from '$ui/scrollable-table.svelte';
	import CalculatorActions from '#lib/components/calculator-actions.svelte';
	import TaxBracketBar from './_components/tax-bracket-bar.svelte';
	import { CURRENT_FINANCIAL_YEAR } from './tax-rates';

	setCalculatorState();
	let calc = getCalculatorState();
	let selectedView = $state('chart');
</script>

<svelte:head>
	<title>Income Tax Calculator | MoneyKit</title>
	<meta
		name="description"
		content="Estimate your Australian income tax for {CURRENT_FINANCIAL_YEAR} including Medicare Levy, Medicare Levy Surcharge, and HELP repayments."
	/>
</svelte:head>

<main class="container">
	<div class="mb-4 flex items-center justify-between">
		<h1 class="heading-primary">Income Tax Calculator</h1>
		<CalculatorActions
			filename="income-tax-calculator.csv"
			getCsvData={() => calc.getTableData()}
		/>
	</div>

	<section class="flex flex-col gap-8 lg:flex-row">
		<Inputs />

		<div class="w-full min-w-0 space-y-4">
			<div class="card">
				<div class="mb-4 flex w-full flex-col gap-2 md:flex-row md:justify-between">
					<div>
						<h2 class="heading-secondary">Outcome</h2>
						<p class="text-xs text-muted-foreground">{CURRENT_FINANCIAL_YEAR} financial year</p>
					</div>
					<Tabs.Root
						value={selectedView}
						onValueChange={(value) => (selectedView = value)}
						class="w-full md:w-fit"
					>
						<Tabs.List class="w-full min-w-48">
							<Tabs.Trigger value="chart">Chart</Tabs.Trigger>
							<Tabs.Trigger value="table">Table</Tabs.Trigger>
						</Tabs.List>
					</Tabs.Root>
				</div>

				<!-- Take-home pay — the one number that gets to be large -->
				<div class="mb-4">
					<p class="text-[11px] text-muted-foreground">Take-home pay</p>
					<p
						class="mt-0.5 text-2xl leading-none font-semibold tracking-tight tabular-nums md:text-3xl"
					>
						{formatCurrency(calc.takeHomePay)}
						<span class="text-sm font-normal text-muted-foreground">/ year</span>
					</p>
				</div>

				<!-- Secondary metrics, deliberately a step below the hero -->
				<div class="mb-5 flex flex-wrap gap-x-8 gap-y-3">
					{@render metric('Taxable income', formatCurrency(calc.result.taxableIncome))}
					{@render metric('Total tax', formatCurrency(calc.result.totalTax))}
					{@render metric('Effective rate', formatPercentage(calc.effectiveRate))}
				</div>

				<div class="mb-5 border-t border-border/60 pt-4">
					<TaxBracketBar />
				</div>

				<Tabs.Root value={selectedView}>
					<Tabs.Content value="chart" class="m-0">
						<TaxBreakdown />
					</Tabs.Content>
					<Tabs.Content value="table" class="m-0">
						<ScrollableTable data={calc.getTableData()} />
					</Tabs.Content>
				</Tabs.Root>
			</div>
		</div>
	</section>
</main>

{#snippet metric(label: string, value: string)}
	<div>
		<p class="text-[11px] text-muted-foreground">{label}</p>
		<p class="mt-0.5 text-base font-semibold tabular-nums">{value}</p>
	</div>
{/snippet}
