<script lang="ts">
	import { formatCurrency, formatPercentage } from '$utils/formatters';
	import SummaryCard from '#lib/components/summary-card.svelte';

	let {
		totalAssets,
		totalLiabilities
	}: {
		totalAssets: number;
		totalLiabilities: number;
	} = $props();

	let networth = $derived(totalAssets - totalLiabilities);
	let assetPercentage = $derived(formatPercentage(totalAssets / (totalAssets + totalLiabilities)));
	let liabilityPercentage = $derived(
		formatPercentage(totalLiabilities / (totalAssets + totalLiabilities))
	);
</script>

<SummaryCard label="Net Worth" value={formatCurrency(networth)}>
	<div class="mt-4 flex h-3 overflow-auto rounded-lg">
		<div class="bg-primary h-full" style="width: {assetPercentage};"></div>
		<div class="bg-red-600 h-full" style="width: {liabilityPercentage};"></div>
	</div>
</SummaryCard>
