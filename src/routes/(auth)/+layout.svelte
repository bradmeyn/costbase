<script lang="ts">
	import { type Snippet } from 'svelte';

	let { children }: { children: Snippet } = $props();
</script>

<svelte:head>
	<title>Costbase</title>
</svelte:head>

<div
	class="flex min-h-screen flex-col items-center justify-center bg-background px-4 text-foreground"
>
	<a href="/" class="mb-8 text-4xl font-medium tracking-tight">
		Cost<span class="text-primary">base</span>
	</a>
	{@render children()}
</div>
