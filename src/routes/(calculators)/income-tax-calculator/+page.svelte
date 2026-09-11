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
	<title>Income Tax Calculator | BudgetKit</title>
	<meta
		name="description"
		content="Estimate your Australian income tax for {CURRENT_FINANCIAL_YEAR} including Medicare Levy, Medicare Levy Surcharge, and HELP repayments."
	/>
</svelte:head>

<main class="container">
	<div class="flex justify-between items-center mb-4">
		<h1 class="heading-primary">Income Tax Calculator</h1>
		<CalculatorActions
			filename="income-tax-calculator.csv"
			getCsvData={() => calc.getTableData()}
		/>
	</div>

	<section class="flex flex-col lg:flex-row gap-8">
		<Inputs />

		<div class="w-full min-w-0 space-y-4">
			<div class="card">
				<div class="flex gap-2 flex-col md:flex-row md:justify-between w-full mb-4">
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

				<!-- Take-home pay — primary metric -->
				<div class="mb-4">
					<p class="text-muted-foreground text-sm">Take-Home Pay</p>
					<p class="text-3xl md:text-4xl font-bold leading-none">
						{formatCurrency(calc.takeHomePay)}
						<span class="text-lg font-normal text-muted-foreground">/ year</span>
					</p>
				</div>

				<!-- Secondary metrics -->
				<div class="flex gap-8 flex-wrap mb-6">
					{@render metric('Taxable Income', formatCurrency(calc.result.taxableIncome))}
					{@render metric('Total Tax', formatCurrency(calc.result.totalTax))}
					{@render metric('Effective Rate', formatPercentage(calc.effectiveRate))}
				</div>

				<div class="mb-6">
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
		<p class="text-muted-foreground text-sm">{label}</p>
		<p class="font-semibold text-xl md:text-2xl">{value}</p>
	</div>
{/snippet}
