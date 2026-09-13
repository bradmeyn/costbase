<script lang="ts">
	import type { Snippet } from 'svelte';

	let {
		label,
		value,
		valueClass = '',
		children
	}: {
		/** Sentence-case caption, e.g. "Current value". */
		label: string;
		/** Pre-formatted value, e.g. "$214,814,544". */
		value: string;
		/** Optional class for the value, e.g. text-gain for gains. */
		valueClass?: string;
		/** Optional content rendered below the value, e.g. a bar. */
		children?: Snippet;
	} = $props();
</script>

<div class="rounded-md border border-border bg-card px-3.5 py-3">
	<p class="text-[11px] font-medium text-muted-foreground">{label}</p>
	<p class="mt-0.5 text-xl font-semibold tracking-tight tabular-nums {valueClass}">{value}</p>
	{@render children?.()}
</div>
