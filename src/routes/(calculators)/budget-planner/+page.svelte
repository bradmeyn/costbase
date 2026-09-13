<script lang="ts">
	import DoughnutChart from '#lib/components/charts/doughnut-chart.svelte';
	import LegendList from '#lib/components/charts/legend-list.svelte';
	import { formatPercentage } from '#lib/utils/formatters.js';
	import { setBudgetState } from './budget.svelte';
	import BudgetCard from './_components/budget-card.svelte';
	import ActionsMenu from './_components/actions-menu.svelte';
	import LoadBudgetAlert from './_components/load-budget-alert.svelte';
	import TabSelect from '#lib/components/inputs/tab-select.svelte';

	const budget = setBudgetState();

	let viewMode = $state<'category' | 'simple'>('simple');

	const viewOptions = [
		{ value: 'category', label: 'Category' },
		{ value: 'simple', label: 'Simple' }
	];

	let chartData = $derived.by(() => {
		const total = budget.totalExpenses;
		let items = budget.expenseByCategory
			.map((item) => ({
				label: item.category,
				value: item.total / total
			}))
			.filter((item) => item.value !== 0);

		return items;
	});
</script>

<svelte:head>
	<title>Budget Planner | Free Budget Planner & Calculator</title>

	<!-- Primary Meta Tags -->
	<meta
		name="description"
		content="Create and manage your personal budget with our free budget planner. Track income, expenses, and savings goals with an easy-to-use budget calculator."
	/>
	<meta
		name="keywords"
		content="budget planner, budget calculator, personal budget, free budget tool, expense tracker, financial planning"
	/>
	<meta name="author" content="Your Site Name" />

	<!-- Open Graph / Facebook -->
	<meta property="og:type" content="website" />
	<meta
		property="og:title"
		content="Free Budget Planner & Calculator - Build Your Personal Budget"
	/>
	<meta
		property="og:description"
		content="Create and manage your personal budget with our free budget planner. Track income, expenses, and savings goals."
	/>
	<meta property="og:url" content="https://moneykit.au/budget-planner" />
	<meta property="og:image" content="https://moneykit.au/budget-preview.jpg" />

	<!-- Additional SEO -->
	<meta name="robots" content="index, follow" />
	<link rel="canonical" href="https://moneykit.au/budget-planner" />
</svelte:head>

<main class="mx-auto flex w-full max-w-300 flex-1 flex-col px-4 md:px-6">
	<LoadBudgetAlert />
	<div class="mb-2 flex items-center justify-between">
		<h1 class="heading-primary">Budget Planner</h1>
		<div class="flex items-center gap-4">
			<ActionsMenu />
		</div>
	</div>

	<div class="mb-4 max-w-60">
		<TabSelect bind:value={viewMode} name="budget-view" options={viewOptions} />
	</div>

	<div class="flex w-full flex-col gap-4 lg:flex-row">
		<div class="flex flex-1 flex-col gap-4">
			<BudgetCard
				type="income"
				categories={budget.categories['income']}
				total={budget.totalIncome}
				items={budget.income}
				{viewMode}
			/>
			<BudgetCard
				type="expense"
				categories={budget.categories['expense']}
				total={budget.totalExpenses}
				items={budget.expenses}
				{viewMode}
			/>
		</div>
		{#if budget.totalExpenses > 0}
			<div class="flex h-fit min-w-75 flex-row flex-wrap gap-4 lg:flex-col">
				<div class="card w-full">
					<h2 class="heading-secondary">Spending Breakdown</h2>
					<DoughnutChart data={chartData} formatter={formatPercentage} />
					<LegendList data={chartData} formatter={formatPercentage} />
				</div>
			</div>
		{/if}
	</div>
</main>
