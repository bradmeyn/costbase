<script lang="ts">
	import Header from '#lib/components/header.svelte';

	let { children } = $props();
</script>

<svelte:head>
	<title>Costbase — Dashboard</title>
</svelte:head>

<div class="flex min-h-screen flex-col bg-background">
	<Header />
	<main class="flex-1 py-8">
		<div class="container max-w-6xl">
			{@render children?.()}
		</div>
	</main>
</div>
