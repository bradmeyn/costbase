<script lang="ts">
	import { formatCurrency } from '#lib/utils.js';
	import RowActionsMenu from '#lib/components/row-actions-menu.svelte';
	import { ArrowUpRight } from '@lucide/svelte';

	let {
		name,
		subtitle,
		amount,
		href,
		onEdit,
		onDelete
	}: {
		name: string;
		subtitle?: string;
		amount: number;
		/** When set, renders a link arrow instead of the edit/delete menu. */
		href?: string;
		onEdit?: () => void;
		onDelete?: () => void;
	} = $props();
</script>

<div class="flex items-center justify-between px-5 py-3.5">
	<div>
		<p class="font-medium">{name}</p>
		{#if subtitle}
			<p class="text-xs text-muted-foreground">{subtitle}</p>
		{/if}
	</div>
	<div class="flex items-center gap-2">
		<p class="font-medium tabular-nums">{formatCurrency(amount)}</p>
		{#if href}
			<a
				{href}
				class="inline-flex size-9 shrink-0 items-center justify-center rounded-md text-muted-foreground outline-none transition-colors hover:bg-accent hover:text-accent-foreground"
				aria-label="View {name}"
			>
				<ArrowUpRight class="size-4" />
			</a>
		{:else if onEdit || onDelete}
			<RowActionsMenu label={name} {onEdit} {onDelete} />
		{/if}
	</div>
</div>
