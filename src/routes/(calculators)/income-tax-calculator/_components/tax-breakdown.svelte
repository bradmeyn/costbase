<script lang="ts">
	import DoughnutChart from '#lib/components/charts/doughnut-chart.svelte';
	import { getCalculatorState } from '../calculator.svelte';
	import { formatCurrency } from '#lib/utils/formatters.js';
	import { COLOURS } from '#lib/constants/colours.js';

	let calc = getCalculatorState();

	let total = $derived(calc.chartData.reduce((sum, d) => sum + d.value, 0));
</script>

{#if calc.chartData.length > 0}
	<!-- Chart and legend sit side by side so each label stays next to its value.
	     Full-width rows would strand the amounts hundreds of pixels from their labels. -->
	<div class="flex flex-col items-center gap-6 sm:flex-row sm:items-center">
		<div class="w-full max-w-44 shrink-0">
			<DoughnutChart data={calc.chartData} formatter={formatCurrency} />
		</div>

		<ul class="w-full max-w-md min-w-0">
			{#each calc.chartData as item, i (item.label)}
				<li
					class="flex items-baseline justify-between gap-3 border-b border-border/60 py-1.5 last:border-b-0"
				>
					<span class="flex min-w-0 items-center gap-2">
						<span
							class="inline-block size-2 shrink-0 rounded-full"
							style="background-color: {COLOURS[i % COLOURS.length]}"
						></span>
						<span class="truncate text-[13px] text-muted-foreground">{item.label}</span>
					</span>
					<span class="flex shrink-0 items-baseline gap-2">
						<span class="text-[11px] text-muted-foreground/70 tabular-nums">
							{total > 0 ? ((item.value / total) * 100).toFixed(1) : '0.0'}%
						</span>
						<span class="text-[13px] font-medium tabular-nums">{formatCurrency(item.value)}</span>
					</span>
				</li>
			{/each}
		</ul>
	</div>
{:else}
	<p class="text-[13px] text-muted-foreground">Enter your income to see a breakdown.</p>
{/if}
