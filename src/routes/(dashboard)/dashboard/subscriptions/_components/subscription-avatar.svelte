<script lang="ts">
	import { brandStyle } from '#lib/constants/subscription-brands.js';

	let { name, size = 36 }: { name: string; size?: number } = $props();
	const style = $derived(brandStyle(name));
</script>

<div
	class="flex shrink-0 items-center justify-center overflow-hidden rounded-full font-semibold text-white {style.svg
		? '[&_svg]:fill-current'
		: ''}"
	style="width: {size}px; height: {size}px; background-color: {style.colour}; font-size: {size *
		0.42}px; color: white;"
	aria-hidden="true"
>
	{#if style.svg}
		<span
			class="flex items-center justify-center [&>svg]:size-full"
			style="width: {size * 0.55}px; height: {size * 0.55}px;"
		>
			<!-- eslint-disable-next-line svelte/no-at-html-tags -->
			{@html style.svg}
		</span>
	{:else}
		{style.letter}
	{/if}
</div>
