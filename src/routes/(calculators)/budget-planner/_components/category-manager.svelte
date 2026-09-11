<script lang="ts">
	import * as Dialog from '#lib/components/ui/dialog/index.js';

	import Button from '$ui/button/button.svelte';
	import Input from '$ui/input/input.svelte';
	import Label from '$ui/label/label.svelte';
	import { Pencil, Trash, Plus, X } from '@lucide/svelte';
	import { type BudgetItem, getBudgetState } from '../budget.svelte';

	let {
		type,
		categories,
		open = $bindable(false)
	}: {
		type: BudgetItem['type'];
		categories: string[];
		open?: boolean;
	} = $props();

	const budget = getBudgetState();

	let newCategoryName = $state('');
	let editingCategory = $state<string | null>(null);
	let editCategoryName = $state('');

	// Get items for the current type
	const typeItems = $derived.by(() => {
		switch (type) {
			case 'income':
				return budget.income;
			case 'expense':
				return budget.expenses;
			default:
				return [] as import('../budget.svelte').BudgetItem[];
		}
	});

	function addCategory() {
		if (!newCategoryName.trim()) return;

		// Check if category already exists
		if (categories.includes(newCategoryName.trim())) {
			newCategoryName = '';
			return;
		}

		// Add category
		budget.addCategory(type, newCategoryName.trim());
		newCategoryName = '';
	}

	function startEdit(category: string) {
		editingCategory = category;
		editCategoryName = category;
	}

	function cancelEdit() {
		editingCategory = null;
		editCategoryName = '';
	}

	function saveEdit() {
		if (!editCategoryName.trim() || !editingCategory) return;

		// Check if new name is different
		if (editCategoryName.trim() === editingCategory) {
			cancelEdit();
			return;
		}

		// Check if category already exists
		if (categories.includes(editCategoryName.trim())) {
			editCategoryName = '';
			cancelEdit();
			return;
		}

		// Update category
		budget.updateCategory(type, editingCategory, editCategoryName.trim());
		newCategoryName = ''; // Reset new category input
		// Close dialog if it was open

		cancelEdit();
	}

	function getItemCount(category: string): number {
		return typeItems.filter((item) => item.category === category).length;
	}

	function handleKeydown(e: KeyboardEvent, action: 'add' | 'edit') {
		if (e.key === 'Enter') {
			if (action === 'add') {
				addCategory();
			} else {
				saveEdit();
			}
		} else if (e.key === 'Escape' && action === 'edit') {
			cancelEdit();
		}
	}
</script>

<Dialog.Root bind:open>
	<Dialog.Content class="max-w-md">
		<Dialog.Header>
			<Dialog.Title>Manage {type} Categories</Dialog.Title>
			<Dialog.Description>
				Add, edit, or remove categories for your {type} items.
			</Dialog.Description>
		</Dialog.Header>

		<div class="space-y-4">
			<!-- Add new category -->
			<div class="space-y-2">
				<Label for="new-category">Add New Category</Label>
				<div class="flex gap-2">
					<Input
						id="new-category"
						bind:value={newCategoryName}
						placeholder="Enter category name"
						onkeydown={(e) => handleKeydown(e, 'add')}
					/>
					<Button
						size="icon"
						variant="outline"
						onclick={addCategory}
						disabled={!newCategoryName.trim()}
					>
						<Plus class="size-4" />
					</Button>
				</div>
			</div>

			<!-- Existing categories -->
			<div class="space-y-2">
				<Label>Existing Categories</Label>
				<div class="space-y-2 max-h-60 overflow-y-auto">
					{#each categories as category (category)}
						<div class="flex items-center justify-between p-2 border rounded-md">
							{#if editingCategory === category}
								<div class="flex gap-2 flex-1">
									<Input
										bind:value={editCategoryName}
										onkeydown={(e) => handleKeydown(e, 'edit')}
										class="flex-1"
									/>
									<Button
										size="sm"
										variant="secondary"
										onclick={saveEdit}
										disabled={!editCategoryName.trim()}
									>
										Save
									</Button>
									<Button size="icon" variant="outline" onclick={cancelEdit}>
										<X class="size-4" />
									</Button>
								</div>
							{:else}
								<div class="flex-1">
									<div class="font-medium">{category}</div>
									<div class="text-sm text-muted-foreground">
										{getItemCount(category)} item{getItemCount(category) !== 1 ? 's' : ''}
									</div>
								</div>
								<div class="flex gap-1">
									<Button size="sm" variant="ghost" onclick={() => startEdit(category)}>
										<Pencil class="size-4" />
									</Button>
									<Button
										size="sm"
										variant="ghost"
										onclick={() => budget.deleteCategory(type, category)}
									>
										<Trash class="size-4" />
									</Button>
								</div>
							{/if}
						</div>
					{/each}

					{#if categories.length === 0}
						<div class="text-center text-muted-foreground py-4">
							No categories yet. Add one above to get started.
						</div>
					{/if}
				</div>
			</div>
		</div>

		<Dialog.Footer>
			<Button variant="outline" onclick={() => (open = false)}>Done</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>
