<script lang="ts">
	import Header from '#lib/components/header.svelte';
	import DashboardSubnav from '#lib/components/dashboard-subnav.svelte';

	let { children } = $props();
</script>

<svelte:head>
	<title>MoneyKit — Dashboard</title>
</svelte:head>

<div class="flex min-h-screen flex-col bg-background">
	<Header />
	<DashboardSubnav />
	<main class="flex-1 py-8">
		<div class="container max-w-6xl">
			{@render children?.()}
		</div>
	</main>
</div>
