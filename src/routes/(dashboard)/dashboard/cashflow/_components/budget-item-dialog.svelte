<script lang="ts">
	import * as Dialog from '$ui/dialog';
	import * as Field from '$ui/field';
	import * as NativeSelect from '$ui/native-select';
	import Input from '$ui/input/input.svelte';
	import { Button } from '$ui/button';
	import {
		addBudgetItem,
		updateBudgetItem,
		getBudgetItems
	} from '#lib/remotes/budget-item.remote.js';
	import { INCOME_CATEGORIES, EXPENSE_CATEGORIES, OWNERS } from '#lib/constants/categories.js';
	import { FREQUENCIES, FREQUENCY_ENUM } from '#lib/constants/frequencies.js';
	import type { BudgetItem } from '$db/schemas/budget';

	let {
		type,
		open,
		onOpenChange,
		item = null
	}: {
		type: 'income' | 'expense';
		open: boolean;
		onOpenChange: (open: boolean) => void;
		/** When set, the dialog edits this item; otherwise it adds a new one. */
		item?: BudgetItem | null;
	} = $props();

	const categories = $derived(type === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES);
	const noun = $derived(type === 'income' ? 'Income' : 'Expense');
</script>

<Dialog.Root {open} {onOpenChange}>
	<Dialog.Content>
		<Dialog.Header>
			<Dialog.Title>{item ? `Edit ${noun}` : `Add ${noun}`}</Dialog.Title>
		</Dialog.Header>

		{#if item}
			{#each updateBudgetItem.fields.issues?.() ?? [] as issue}
				<p class="text-sm text-destructive">{issue.message}</p>
			{/each}
			<form
				{...updateBudgetItem.enhance(async (form) => {
					await form.submit().updates(getBudgetItems());
					if (form.result?.success) onOpenChange(false);
				})}
				class="space-y-4"
			>
				<input type="hidden" {...updateBudgetItem.fields.id.as('text')} value={item.id} />
				<input type="hidden" {...updateBudgetItem.fields.type.as('text')} value={type} />

				<Field.Field>
					<Field.Label>Name</Field.Label>
					<Input {...updateBudgetItem.fields.name.as('text')} value={item.name} />
					<Field.Error />
				</Field.Field>

				<div class="grid grid-cols-2 gap-3">
					<Field.Field>
						<Field.Label>Amount ($)</Field.Label>
						<Input
							{...updateBudgetItem.fields.amount.as('text')}
							inputmode="decimal"
							value={item.amount / 100}
						/>
						<Field.Error />
					</Field.Field>
					<Field.Field>
						<Field.Label>Frequency</Field.Label>
						<NativeSelect.Root
							{...updateBudgetItem.fields.frequency.as('text')}
							value={item.frequency}
						>
							{#each FREQUENCY_ENUM as f}
								<NativeSelect.Option value={f}>{FREQUENCIES[f].label}</NativeSelect.Option>
							{/each}
						</NativeSelect.Root>
					</Field.Field>
				</div>

				<div class="grid grid-cols-2 gap-3">
					<Field.Field>
						<Field.Label>Category</Field.Label>
						<NativeSelect.Root
							{...updateBudgetItem.fields.category.as('text')}
							value={item.category}
						>
							{#each categories as c}
								<NativeSelect.Option value={c}>{c}</NativeSelect.Option>
							{/each}
						</NativeSelect.Root>
						<Field.Error />
					</Field.Field>
					<Field.Field>
						<Field.Label>Owner</Field.Label>
						<NativeSelect.Root
							{...updateBudgetItem.fields.owner.as('text')}
							value={item.owner ?? OWNERS[0]}
						>
							{#each OWNERS as owner}
								<NativeSelect.Option value={owner}>{owner}</NativeSelect.Option>
							{/each}
						</NativeSelect.Root>
						<Field.Error />
					</Field.Field>
				</div>

				<div class="flex justify-end gap-2">
					<Button type="button" variant="outline" onclick={() => onOpenChange(false)}>Cancel</Button
					>
					<Button type="submit" disabled={!!updateBudgetItem.pending}>Save</Button>
				</div>
			</form>
		{:else}
			{#each addBudgetItem.fields.issues?.() ?? [] as issue}
				<p class="text-sm text-destructive">{issue.message}</p>
			{/each}
			<form
				{...addBudgetItem.enhance(async (form) => {
					await form.submit().updates(getBudgetItems());
					if (form.result?.success) {
						form.element.reset();
						onOpenChange(false);
					}
				})}
				class="space-y-4"
			>
				<input type="hidden" {...addBudgetItem.fields.type.as('text')} value={type} />

				<Field.Field>
					<Field.Label>Name</Field.Label>
					<Input {...addBudgetItem.fields.name.as('text')} placeholder="e.g., {noun}" />
					<Field.Error />
				</Field.Field>

				<div class="grid grid-cols-2 gap-3">
					<Field.Field>
						<Field.Label>Amount ($)</Field.Label>
						<Input
							{...addBudgetItem.fields.amount.as('text')}
							inputmode="decimal"
							placeholder="0.00"
						/>
						<Field.Error />
					</Field.Field>
					<Field.Field>
						<Field.Label>Frequency</Field.Label>
						<NativeSelect.Root {...addBudgetItem.fields.frequency.as('text')} value="monthly">
							{#each FREQUENCY_ENUM as f}
								<NativeSelect.Option value={f}>{FREQUENCIES[f].label}</NativeSelect.Option>
							{/each}
						</NativeSelect.Root>
					</Field.Field>
				</div>

				<div class="grid grid-cols-2 gap-3">
					<Field.Field>
						<Field.Label>Category</Field.Label>
						<NativeSelect.Root {...addBudgetItem.fields.category.as('text')}>
							{#each categories as c}
								<NativeSelect.Option value={c}>{c}</NativeSelect.Option>
							{/each}
						</NativeSelect.Root>
						<Field.Error />
					</Field.Field>
					<Field.Field>
						<Field.Label>Owner</Field.Label>
						<NativeSelect.Root {...addBudgetItem.fields.owner.as('text')} value={OWNERS[2]}>
							{#each OWNERS as owner}
								<NativeSelect.Option value={owner}>{owner}</NativeSelect.Option>
							{/each}
						</NativeSelect.Root>
						<Field.Error />
					</Field.Field>
				</div>

				<div class="flex justify-end gap-2">
					<Button type="button" variant="outline" onclick={() => onOpenChange(false)}>Cancel</Button
					>
					<Button type="submit" disabled={!!addBudgetItem.pending}>Add</Button>
				</div>
			</form>
		{/if}
	</Dialog.Content>
</Dialog.Root>
