<script lang="ts">
	import { formatCurrency } from '#lib/utils/formatters.js';
	import { brandStyle } from '#lib/constants/subscription-brands.js';

	let {
		spend
	}: {
		/** Subscriptions with a monthly-normalised figure, sorted high → low. */
		spend: { id: string; name: string; monthly: number }[];
	} = $props();

	const maxMonthly = $derived(Math.max(0, ...spend.map((s) => s.monthly)));
</script>

<div class="card">
	<h2 class="mb-4 font-medium">Monthly spend</h2>
	<div class="space-y-2.5">
		{#each spend as s (s.id)}
			<div class="flex items-center gap-3">
				<span class="w-24 shrink-0 truncate text-sm" title={s.name}>{s.name}</span>
				<div class="h-2.5 flex-1 overflow-hidden rounded-full bg-muted">
					<div
						class="h-full rounded-full"
						style="width: {maxMonthly > 0
							? (s.monthly / maxMonthly) * 100
							: 0}%; background-color: {brandStyle(s.name).colour};"
					></div>
				</div>
				<span class="w-16 shrink-0 text-right text-sm tabular-nums">
					{formatCurrency(s.monthly)}
				</span>
			</div>
		{/each}
	</div>
</div>
