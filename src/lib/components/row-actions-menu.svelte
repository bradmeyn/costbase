<script lang="ts">
	import * as DropdownMenu from '#lib/components/ui/dropdown-menu/index.js';
	import { EllipsisVertical, Pencil, Trash2 } from '@lucide/svelte';
	import type { Snippet } from 'svelte';

	let {
		onEdit,
		onDelete,
		editLabel = 'Edit',
		deleteLabel = 'Delete',
		label = 'item',
		items,
		align = 'end'
	}: {
		onEdit?: () => void;
		onDelete?: () => void;
		editLabel?: string;
		deleteLabel?: string;
		label?: string;
		items?: Snippet;
		align?: 'start' | 'center' | 'end';
	} = $props();
</script>

<DropdownMenu.Root>
	<DropdownMenu.Trigger
		class="inline-flex size-9 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors outline-none hover:bg-accent hover:text-accent-foreground"
		aria-label="More options for {label}"
	>
		<EllipsisVertical class="size-4" />
	</DropdownMenu.Trigger>
	<DropdownMenu.Content {align}>
		<DropdownMenu.Group>
			{#if onEdit}
				<DropdownMenu.Item onSelect={onEdit}>
					<Pencil class="size-4" />
					<span>{editLabel}</span>
				</DropdownMenu.Item>
			{/if}

			{@render items?.()}

			{#if onDelete}
				<DropdownMenu.Item
					onSelect={onDelete}
					class="text-destructive data-highlighted:text-destructive"
				>
					<Trash2 class="size-4 text-destructive" />
					<span>{deleteLabel}</span>
				</DropdownMenu.Item>
			{/if}
		</DropdownMenu.Group>
	</DropdownMenu.Content>
</DropdownMenu.Root>
