<script lang="ts">
	import { Button } from '$ui/button';
	import { Plus } from '@lucide/svelte';
	import { formatCurrency } from '#lib/utils.js';
	import type { Snippet } from 'svelte';

	let {
		title,
		total,
		onAdd,
		empty,

		children
	}: {
		title: 'Assets' | 'Liabilities';
		total: number;
		onAdd: () => void;
		/** Message shown when the section has no rows. */
		empty: string;

		children: Snippet;
	} = $props();

	let dotColour = $derived(title == 'Assets' ? 'bg-primary' : 'bg-red-500');
</script>

<div class="space-y-3">
	<div class="flex items-center justify-between">
		<h2 class="flex items-center gap-3 font-medium ml-2">
			<span class="flex items-center gap-2">
				<span class="block size-2 rounded-full {dotColour}"></span>
				<span>{title}</span>
			</span>
			<span class="text-sm text-muted-foreground tabular-nums">{formatCurrency(total)}</span>
		</h2>
		<Button size="sm" variant="outline" onclick={onAdd}>
			<Plus class="mr-1 size-3.5" /> Add
		</Button>
	</div>

	<div class="card divide-y divide-border p-0">
		{@render children()}
		{#if empty}
			<p class="px-5 py-3.5 text-sm text-muted-foreground">{empty}</p>
		{/if}
	</div>
</div>
