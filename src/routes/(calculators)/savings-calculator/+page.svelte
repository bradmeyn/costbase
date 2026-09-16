<script lang="ts">
	import { setCalculatorState, getCalculatorState } from './calculator.svelte';
	import * as Tabs from '#lib/components/ui/tabs/index.js';
	import { formatCurrency } from '#lib/utils/formatters.js';
	import { Flame, CheckCircle, XCircle } from '@lucide/svelte';
	import Inputs from './_components/savings-inputs.svelte';
	import GrowthChart from './_components/growth-chart.svelte';
	import ScrollableTable from '$ui/scrollable-table.svelte';
	import CalculatorActions from '#lib/components/calculator-actions.svelte';

	setCalculatorState();
	let calculator = getCalculatorState();
	let selectedView = $state('chart');
</script>

<svelte:head>
	<title>Savings & FIRE Calculator | Costbase</title>
	<meta
		name="description"
		content="Project your savings growth, track progress towards a savings goal, or calculate your FIRE number and time to financial independence."
	/>
</svelte:head>

<main class="container">
	<div class="mb-4 flex items-center justify-between">
		<h1 class="heading-primary">Savings & FIRE Calculator</h1>
		<CalculatorActions
			filename="savings-calculator.csv"
			getCsvData={() => calculator.getTableData()}
		/>
	</div>

	<section class="flex flex-col gap-8 lg:flex-row">
		<Inputs />

		<div class="w-full min-w-0 space-y-4">
			<div class="card">
				<div class="mb-4 flex w-full flex-col gap-2 md:flex-row md:justify-between">
					<h2 class="heading-secondary">Outcome</h2>
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

				<div class="mb-4 space-y-4">
					<div class="flex flex-wrap gap-8">
						{@render metric(
							'Value after ' + calculator.years + ' years',
							calculator.result.totalValue
						)}
						{@render metric('Total Contributions', calculator.result.totalContributions)}
						{@render metric('Total Interest', calculator.result.totalInterest)}
					</div>

					<div class="flex flex-wrap items-start gap-8">
						{@render metric(
							calculator.mode === 'fire' ? 'FIRE Number' : 'Savings Goal',
							calculator.goal
						)}

						<div>
							<p class="mb-1 text-muted-foreground">
								{calculator.mode === 'fire' ? 'Time to FIRE' : 'Time to Goal'}
							</p>
							{#if calculator.yearsToGoal !== null}
								<div class="flex items-center gap-2">
									{#if calculator.mode === 'fire'}
										<Flame class="size-6 shrink-0 text-primary" />
									{:else}
										<CheckCircle class="size-6 shrink-0 text-primary" />
									{/if}
									<div>
										<p class="text-3xl leading-none font-bold md:text-4xl">
											{calculator.yearsToGoal}
											<span class="text-xl font-semibold text-muted-foreground">yrs</span>
										</p>
										<p class="mt-0.5 text-sm text-muted-foreground">
											{calculator.mode === 'fire' ? 'Retire in' : 'Reach goal in'}
											{new Date().getFullYear() + calculator.yearsToGoal}
										</p>
									</div>
								</div>
							{:else}
								<div class="flex items-center gap-2">
									<XCircle class="size-6 shrink-0 text-loss" />
									<p class="text-xl font-semibold text-muted-foreground">Not reached</p>
								</div>
							{/if}
						</div>
					</div>
				</div>

				<Tabs.Root value={selectedView}>
					<Tabs.Content value="chart" class="m-0">
						<GrowthChart
							annualData={calculator.result.annualData}
							savingsGoal={calculator.goal}
							bandData={calculator.bandData}
						/>
					</Tabs.Content>
					<Tabs.Content value="table" class="m-0">
						<ScrollableTable data={calculator.getTableData()} />
					</Tabs.Content>
				</Tabs.Root>
			</div>
		</div>
	</section>
</main>

{#snippet metric(label: string, value: number)}
	<div>
		<p class="text-muted-foreground">{label}</p>
		<p class="text-xl font-semibold md:text-2xl">{formatCurrency(value)}</p>
	</div>
{/snippet}
