<script lang="ts">
	import * as DropdownMenu from '#lib/components/ui/dropdown-menu/index.js';
	import { EllipsisVertical, Pencil, Trash } from '@lucide/svelte';
	import { type BudgetItem, getBudgetState } from '../budget.svelte';
	import ClearAllDialog from './clear-all-dialog.svelte';
	import CategoryManager from './category-manager.svelte';

	let { type }: { type: BudgetItem['type'] } = $props();
	const budget = getBudgetState();

	let manageCategoriesOpen = $state(false);
	let deleteItemsOpen = $state(false);
</script>

<DropdownMenu.Root>
	<DropdownMenu.Trigger
		class="inline-flex h-9 w-9 shrink-0 items-center justify-center gap-2 rounded-md text-sm font-medium transition-all outline-none hover:bg-accent hover:text-accent-foreground disabled:pointer-events-none disabled:opacity-50"
	>
		<EllipsisVertical class="size-4" />
	</DropdownMenu.Trigger>
	<DropdownMenu.Content>
		<DropdownMenu.Group>
			<DropdownMenu.Item onSelect={() => (manageCategoriesOpen = true)}>
				<Pencil />
				<span>Manage Categories</span>
			</DropdownMenu.Item>
			<DropdownMenu.Item
				onSelect={() => (deleteItemsOpen = true)}
				class="text-destructive data-highlighted:text-destructive"
			>
				<Trash class="text-destructive" />
				<span>Delete Items</span>
			</DropdownMenu.Item>
		</DropdownMenu.Group>
	</DropdownMenu.Content>
</DropdownMenu.Root>

<CategoryManager {type} categories={budget.categories[type]} bind:open={manageCategoriesOpen} />

<ClearAllDialog
	text="all {type} items"
	onDelete={() => budget.deleteItemsByType(type)}
	bind:open={deleteItemsOpen}
/>
