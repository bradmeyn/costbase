<script lang="ts">
	import { type Snippet } from 'svelte';

	let { children }: { children: Snippet } = $props();
</script>

<svelte:head>
	<title>MoneyKit</title>
</svelte:head>

<div class="min-h-screen flex flex-col items-center justify-center bg-white text-foreground px-4">
	<a href="/" class="mb-8 text-4xl font-medium tracking-tight">
		Money<span class="text-brand">Kit</span>
	</a>
	{@render children()}
</div>
