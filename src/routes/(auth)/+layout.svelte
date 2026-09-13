<script lang="ts">
	import { type Snippet } from 'svelte';

	let { children }: { children: Snippet } = $props();
</script>

<svelte:head>
	<title>MoneyKit</title>
</svelte:head>

<div
	class="flex min-h-screen flex-col items-center justify-center bg-background px-4 text-foreground"
>
	<a href="/" class="mb-8 text-4xl font-medium tracking-tight">
		Money<span class="text-primary">Kit</span>
	</a>
	{@render children()}
</div>
