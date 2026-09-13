<script lang="ts">
	import { getBudgetState, convertToFrequency, type BudgetItem } from '../budget.svelte';
	import CurrencyInput from '#lib/components/inputs/currency-input.svelte';
	import FrequencySelect from '#lib/components/inputs/frequency-select.svelte';
	import { formatCurrency } from '#lib/utils/formatters.js';
	import { FREQUENCIES } from '#lib/constants/frequencies.js';
	import { Trash } from '@lucide/svelte';
	import Button from '$ui/button/button.svelte';
	import AddItemDialog from './add-item-dialog.svelte';
	import * as Select from '#lib/components/ui/select/index.js';

	let {
		items,
		type,
		categories
	}: {
		items: BudgetItem[];
		type: BudgetItem['type'];
		categories: string[];
	} = $props();

	const budget = getBudgetState();
</script>

{#if items.length > 0}
	<div class="overflow-x-auto">
		<table class="w-full text-sm">
			<thead>
				<tr class="border-b border-border">
					<th class="pr-2 pb-2 text-left font-medium text-muted-foreground">Name</th>
					<th class="pr-2 pb-2 text-left font-medium text-muted-foreground">Category</th>
					<th class="pr-2 pb-2 text-left font-medium text-muted-foreground">Amount</th>
					<th class="pr-2 pb-2 text-left font-medium text-muted-foreground">Frequency</th>
					<th class="pr-2 pb-2 text-right font-medium text-muted-foreground">
						Total/{FREQUENCIES[budget.frequency].singular}
					</th>
					<th class="pb-2"></th>
				</tr>
			</thead>
			<tbody>
				{#each items as item (item.id)}
					<tr class="border-b border-border/40 last:border-0">
						<td class="py-1.5 pr-2">
							<input
								type="text"
								value={item.name}
								onblur={(e) =>
									budget.updateItem({ ...item, name: e.currentTarget.value.trim() || item.name })}
								onkeydown={(e) => {
									if (e.key === 'Enter') e.currentTarget.blur();
								}}
								class="w-full min-w-[100px] border-b border-transparent bg-transparent px-1 py-0.5 hover:border-border focus:border-border focus:outline-none"
							/>
						</td>
						<td class="py-1.5 pr-2">
							<Select.Root
								type="single"
								value={item.category}
								onValueChange={(value) => budget.updateItem({ ...item, category: value })}
							>
								<Select.Trigger class="min-w-[120px]">
									{item.category || 'Select category'}
								</Select.Trigger>
								<Select.Content>
									{#each categories as cat (cat)}
										<Select.Item value={cat}>{cat}</Select.Item>
									{/each}
								</Select.Content>
							</Select.Root>
						</td>
						<td class="w-36 py-1.5 pr-2">
							<CurrencyInput
								value={item.amount}
								onchange={(value) => budget.updateItem({ ...item, amount: value })}
							/>
						</td>
						<td class="w-40 py-1.5 pr-2">
							<FrequencySelect
								value={item.frequency}
								onchange={(frequency) => budget.updateItem({ ...item, frequency })}
								id={item.id + '-frequency'}
								name={item.id + '-frequency'}
							/>
						</td>
						<td class="min-w-[80px] py-1.5 pr-2 text-right font-semibold">
							{formatCurrency(convertToFrequency(item.amount, item.frequency, budget.frequency))}
						</td>
						<td class="px-0 py-1.5">
							<Button
								size="icon"
								variant="ghost"
								onclick={() => budget.removeItem(item.id)}
								aria-label="Delete {item.name}"
							>
								<Trash class="size-4" />
							</Button>
						</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
{/if}

<div class="mt-2 flex justify-end">
	<AddItemDialog {type} />
</div>
