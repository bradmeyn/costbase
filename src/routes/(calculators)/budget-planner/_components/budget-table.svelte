<script lang="ts">
	import type { BudgetItem as Item } from '../budget.svelte';
	import BudgetItem from './budget-item.svelte';
	let { items }: { items: Item[] } = $props();
</script>

{#if items.length > 0}
	<table class="w-full">
		<thead>
			<tr>
				<th>Item</th>
				<th>Amount</th>
				<th class=" hidden md:block">Frequency</th>
				<th class="text-right">Total</th>
				<th class="text-right"> </th>
			</tr>
		</thead>
		<tbody>
			{#each items as budgetItem (budgetItem.id)}
				<BudgetItem {budgetItem} />
			{/each}
		</tbody>
	</table>
{:else}
	<p class="p-2 text-center text-muted-foreground">No items in this category</p>
{/if}
