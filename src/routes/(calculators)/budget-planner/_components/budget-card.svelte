<script lang="ts">
	import { FREQUENCIES } from '#lib/constants/frequencies.js';
	import { formatCurrency } from '#lib/utils/formatters.js';
	import BudgetCardMenu from './budget-card-menu.svelte';
	import { getBudgetState, calculateCategoryTotal, type BudgetItem } from '../budget.svelte';
	import BudgetTable from './budget-table.svelte';
	import BudgetAccordion from './budget-accordion.svelte';
	import AddItemDialog from './add-item-dialog.svelte';
	import BudgetFlatTable from './budget-flat-table.svelte';

	let {
		type,
		total,
		categories,
		items,
		viewMode = 'category'
	}: {
		categories: string[];
		type: BudgetItem['type'];
		total: number;
		items: BudgetItem[];
		viewMode?: 'category' | 'simple';
	} = $props();

	const budget = getBudgetState();

	function changeFrequency() {
		const keys = Object.keys(FREQUENCIES) as (keyof typeof FREQUENCIES)[];
		const currentIndex = keys.indexOf(budget.frequency);
		const nextIndex = (currentIndex + 1) % keys.length;
		budget.frequency = keys[nextIndex];
	}

	const title: Record<BudgetItem['type'], string> = {
		income: 'Income',
		expense: 'Expenses'
	};
</script>

<div class="card">
	<div class="flex items-start justify-between">
		<div>
			<h2 class="heading-secondary mb-2">{title[type]}</h2>
			<div class="flex items-baseline gap-2">
				<p class={`text-2xl font-semibold  ${total < 0 ? 'text-red-400' : ''}`}>
					{formatCurrency(total)}
				</p>
				<button
					class="text-muted-foreground hover:text-foreground transition-colors duration-150"
					onclick={changeFrequency}
				>
					/ {FREQUENCIES[budget.frequency].singular}
				</button>
			</div>
		</div>
		<BudgetCardMenu {type} />
	</div>

	<div class="mt-2">
		{#if viewMode === 'simple'}
			<BudgetFlatTable {items} {type} {categories} />
		{:else}
			{#each categories as category}
				{@const categoryItems = items.filter((i) => i.category === category && i.type === type)}

				<BudgetAccordion
					{type}
					{category}
					categoryTotal={calculateCategoryTotal(items, category, budget.frequency)}
				>
					<BudgetTable items={categoryItems} />
				</BudgetAccordion>
			{/each}
			<div class="mt-2 flex justify-end">
				<AddItemDialog {type} />
			</div>
		{/if}
	</div>
</div>
