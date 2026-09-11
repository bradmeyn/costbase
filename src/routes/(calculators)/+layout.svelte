<script lang="ts">
	import Header from '#lib/components/header/header.svelte';
	import { type Snippet } from 'svelte';

	let { children }: { children: Snippet } = $props();

	const year = new Date().getFullYear();
</script>

<svelte:head>
	<title>MoneyKit</title>
	<meta
		name="description"
		content="Free personal finance tools to help you budget, save, and plan for the future."
	/>
</svelte:head>

<div class="antialiased min-h-screen flex flex-col bg-background text-foreground app-shell">
	<Header />
	<div class="pb-12">
		{@render children()}
	</div>
	<footer class="mt-auto border-t border-border bg-card py-4">
		<p class="text-xs text-center">© {year} MoneyKit</p>
	</footer>
</div>
