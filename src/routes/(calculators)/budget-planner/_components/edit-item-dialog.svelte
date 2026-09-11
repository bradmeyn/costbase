<script lang="ts">
	import { Button } from '#lib/components/ui/button/index.js';
	import * as Dialog from '#lib/components/ui/dialog/index.js';
	import * as Select from '#lib/components/ui/select/index.js';
	import CurrencyInput from '#lib/components/inputs/currency-input.svelte';
	import FrequencyInput from '#lib/components/inputs/frequency-select.svelte';
	import type { BudgetItem as BudgetItemType } from '../budget.svelte';
	import Input from '$ui/input/input.svelte';

	import { getBudgetState } from '../budget.svelte';

	import Label from '$ui/label/label.svelte';
	import { untrack } from 'svelte';

	let {
		budgetItem,
		open = $bindable(false)
	}: {
		budgetItem: BudgetItemType;
		open?: boolean;
	} = $props();

	const budget = getBudgetState();
	let editedItem = $state<BudgetItemType>({
		id: '',
		name: '',
		amount: 0,
		frequency: 'monthly',
		category: '',
		type: 'income'
	});

	$effect(() => {
		if (open) {
			editedItem = untrack(() => ({ ...budgetItem }));
		}
	});

	const isValid = $derived(editedItem.name.trim().length > 0 && editedItem.amount > 0);
	let nameTouched = $state(false);
	let amountTouched = $state(false);
	const nameError = $derived(
		nameTouched && editedItem.name.trim().length === 0 ? 'Name is required.' : ''
	);
	const amountError = $derived(
		amountTouched && editedItem.amount <= 0 ? 'Amount must be greater than 0.' : ''
	);

	function handleSubmit() {
		if (isValid) {
			budget.updateItem({
				...editedItem,
				name: editedItem.name.trim(),
				category: editedItem.category
			});

			open = false;
		}
	}

	function handleCancel() {
		nameTouched = false;
		amountTouched = false;
		open = false;
	}
</script>

<Dialog.Root bind:open>
	<Dialog.Content class="sm:max-w-[500px] ">
		<Dialog.Header class="text-start">
			<Dialog.Title
				>Edit {budgetItem.type === 'income'
					? 'Income'
					: budgetItem.type === 'expense'
						? 'Expense'
						: 'Savings'} Item</Dialog.Title
			>
			<Dialog.Description>
				Edit {budgetItem.type === 'income'
					? 'income'
					: budgetItem.type === 'expense'
						? 'expense'
						: 'savings'} item in the {budgetItem.category} category.
			</Dialog.Description>
		</Dialog.Header>

		<div class="space-y-4 py-4">
			<div class="space-y-2">
				<label for="item-name" class="text-sm font-medium">Name</label>
				<Input
					bind:value={editedItem.name}
					id="item-name"
					placeholder="Enter item name"
					onblur={() => (nameTouched = true)}
				/>
				{#if nameError}<p class="text-destructive text-xs mt-1">{nameError}</p>{/if}
			</div>

			<div class="grid grid-cols-2 gap-4">
				<div class="space-y-2">
					<Label for="item-amount" class="text-sm font-medium">Amount</Label>
					<CurrencyInput
						id="item-amount"
						bind:value={editedItem.amount}
						onchange={() => (amountTouched = true)}
					/>
					{#if amountError}<p class="text-destructive text-xs mt-1">{amountError}</p>{/if}
				</div>

				<div class="space-y-2">
					<label for="item-frequency" class="text-sm font-medium">Frequency</label>
					<FrequencyInput bind:value={editedItem.frequency} id="item-frequency" />
				</div>
			</div>

			<div>
				<Label for="item-category" class="text-sm font-medium">Category</Label>
				<Select.Root
					type="single"
					bind:value={editedItem.category}
					onValueChange={(value) => (editedItem.category = value)}
				>
					<Select.Trigger class="w-full">
						{#if !editedItem.category}
							<span>Select a category</span>
						{:else}
							<span>{editedItem.category}</span>
						{/if}
					</Select.Trigger>
					<Select.Content>
						<Select.Group>
							{#each [...budget.categories[budgetItem.type]] as category}
								<Select.Item value={category} />
							{/each}
						</Select.Group>
					</Select.Content>
				</Select.Root>
			</div>
		</div>

		<Dialog.Footer class="flex gap-2">
			<Button variant="outline" onclick={handleCancel}>Cancel</Button>
			<Button onclick={handleSubmit} disabled={!isValid}>Update Item</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>
