<script lang="ts">
	import * as DropdownMenu from '#lib/components/ui/dropdown-menu/index.js';
	import { Trash, Save, RefreshCcw } from '@lucide/svelte';
	import ClearAllDialog from './clear-all-dialog.svelte';
	import { getBudgetState } from '../budget.svelte';
	import CalculatorActions from '#lib/components/calculator-actions.svelte';
	const budget = getBudgetState();

	let deleteItemsOpen = $state(false);
	let clearBudgetOpen = $state(false);
</script>

<CalculatorActions getCsvData={() => budget.getDownloadData()} filename="budget.csv">
	{#snippet items()}
		<DropdownMenu.Separator />
		<DropdownMenu.Item onSelect={() => budget.saveToStorage()}>
			<Save class="size-4" />
			<span>Save Budget</span>
		</DropdownMenu.Item>

		<DropdownMenu.Separator />
		<DropdownMenu.Item onSelect={() => budget.resetBudget()}>
			<RefreshCcw />
			<span>Reset Budget</span>
		</DropdownMenu.Item>

		<DropdownMenu.Separator />
		<DropdownMenu.Item
			onSelect={() => (deleteItemsOpen = true)}
			class="text-destructive data-highlighted:text-destructive"
		>
			<Trash class="text-destructive" />
			<span>Delete Items</span>
		</DropdownMenu.Item>

		<DropdownMenu.Separator />
		<DropdownMenu.Item
			onSelect={() => (clearBudgetOpen = true)}
			class="text-destructive data-highlighted:text-destructive"
		>
			<Trash class="text-destructive" />
			<span>Clear Budget</span>
		</DropdownMenu.Item>
	{/snippet}
</CalculatorActions>

<ClearAllDialog onDelete={() => budget.deleteItemsByType()} bind:open={deleteItemsOpen} />

<ClearAllDialog onDelete={() => budget.clearBudget()} bind:open={clearBudgetOpen} />
