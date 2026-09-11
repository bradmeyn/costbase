<script lang="ts">
	import CurrencyInput from '#lib/components/inputs/currency-input.svelte';
	import { formatCurrency } from '#lib/utils/formatters.js';
	import { convertToFrequency, type BudgetItem } from '../budget.svelte';
	import FrequencyInput from '#lib/components/inputs/frequency-select.svelte';
	import { Pencil, Trash } from '@lucide/svelte';
	import { getBudgetState } from '../budget.svelte';
	import Button from '$ui/button/button.svelte';
	import { FREQUENCIES } from '$constants/frequencies';
	import RowActionsMenu from '#lib/components/row-actions-menu.svelte';
	import EditItemDialog from './edit-item-dialog.svelte';

	let {
		budgetItem
	}: {
		budgetItem: BudgetItem;
	} = $props();

	const budget = getBudgetState();
	let editOpen = $state(false);
</script>

<tr class="hidden md:table-row">
	<td class="text-sm w-50 font-semibold">{budgetItem.name}</td>
	<td class="w-40">
		<CurrencyInput
			onchange={(value) =>
				budget.updateItem({
					...budgetItem,
					amount: value
				})}
			value={budgetItem.amount}
		/>
	</td>
	<td class="w-44">
		<FrequencyInput
			value={budgetItem.frequency}
			onchange={(frequency) =>
				budget.updateItem({
					...budgetItem,
					frequency
				})}
			id={budgetItem.name + 'frequency'}
			name={budgetItem.name + '-frequency'}
		/>
	</td>
	<td class="text-right min-w-[80px] relative font-semibold">
		<span
			>{formatCurrency(
				convertToFrequency(budgetItem.amount, budgetItem.frequency, budget.frequency)
			)}</span
		>
	</td>
	<td class="text-right px-0 flex items-center justify-end gap-0">
		<Button
			size="icon"
			variant="ghost"
			onclick={() => (editOpen = true)}
			aria-label="Edit {budgetItem.name}"
		>
			<Pencil class="size-4" />
		</Button>
		<Button
			size="icon"
			variant="ghost"
			onclick={() => budget.removeItem(budgetItem.id)}
			aria-label="Delete {budgetItem.name}"
		>
			<Trash />
		</Button>
	</td>
</tr>

<tr class="md:hidden">
	<td class="text-sm">{budgetItem.name}</td>
	<td class="w-40">
		{formatCurrency(budgetItem.amount)} / {FREQUENCIES[budgetItem.frequency].singular}
	</td>
	<td class="text-right min-w-[80px] relative font-semibold">
		<span
			>{formatCurrency(
				convertToFrequency(budgetItem.amount, budgetItem.frequency, budget.frequency)
			)}</span
		>
	</td>
	<td class="text-right px-0">
		<RowActionsMenu
			label={budgetItem.name}
			editLabel="Edit Item"
			deleteLabel="Delete Item"
			onEdit={() => (editOpen = true)}
			onDelete={() => budget.removeItem(budgetItem.id)}
		/>
	</td>
</tr>

<EditItemDialog {budgetItem} bind:open={editOpen} />
