<script lang="ts">
	import { getCalculatorState } from '../calculator.svelte';
	import { formatCurrency } from '#lib/utils/formatters.js';

	let calc = getCalculatorState();

	const MAX_DISPLAY = 250_000;

	const BRACKETS = [
		{ min: 0, max: 18_200, rate: 0, label: '0%' },
		{ min: 18_201, max: 45_000, rate: 0.16, label: '16%' },
		{ min: 45_001, max: 135_000, rate: 0.3, label: '30%' },
		{ min: 135_001, max: 190_000, rate: 0.37, label: '37%' },
		{ min: 190_001, max: MAX_DISPLAY, rate: 0.45, label: '45%' }
	];

	let taxableIncome = $derived(calc.result.taxableIncome);

	let activeBracketIndex = $derived(
		taxableIncome <= 0 ? -1 : BRACKETS.findIndex((b) => taxableIncome <= b.max)
	);

	function widthPct(b: (typeof BRACKETS)[number]): number {
		return ((b.max - b.min) / MAX_DISPLAY) * 100;
	}

	/** How much of this bracket the income reaches into, 0–1. */
	function fillRatio(b: (typeof BRACKETS)[number]): number {
		const span = b.max - b.min;
		if (span <= 0) return 0;
		return Math.min(Math.max((taxableIncome - b.min) / span, 0), 1);
	}
</script>

<div>
	<div class="mb-1.5 flex items-baseline justify-between text-[11px]">
		<span class="text-muted-foreground">
			Tax brackets {taxableIncome > MAX_DISPLAY ? '(capped at $250k)' : ''}
		</span>
		{#if activeBracketIndex >= 0}
			<span class="font-medium text-brand-2">
				{BRACKETS[activeBracketIndex].label} bracket
			</span>
		{/if}
	</div>

	<!-- Each segment is a neutral track filled in green to the point the income reaches.
	     Brackets already crossed read quieter than the one the income sits in. -->
	<div class="relative">
		<div class="flex h-2.5 gap-px">
			{#each BRACKETS as bracket, i (bracket.min)}
				<div
					class="relative h-full overflow-hidden rounded-[2px] bg-muted first:rounded-l-md last:rounded-r-md"
					style="width: {widthPct(bracket)}%"
					title="{bracket.label} — {formatCurrency(bracket.min)} to {bracket.max === MAX_DISPLAY
						? formatCurrency(bracket.min) + '+'
						: formatCurrency(bracket.max)}"
				>
					<div
						class="h-full transition-[width] duration-200 {activeBracketIndex === i
							? 'bg-brand-2'
							: 'bg-brand-2/45'}"
						style="width: {fillRatio(bracket) * 100}%"
					></div>
				</div>
			{/each}
		</div>
	</div>

	<!-- Threshold labels -->
	<div class="relative mt-1.5 h-3.5">
		{#each BRACKETS as bracket, i (bracket.min)}
			{#if i > 0}
				<span
					class="absolute -translate-x-1/2 text-[10px] whitespace-nowrap text-muted-foreground tabular-nums"
					style="left: {((bracket.min - 1) / MAX_DISPLAY) * 100}%"
				>
					{formatCurrency(bracket.min - 1)}
				</span>
			{/if}
		{/each}
	</div>

	<!-- Rate labels. Kept legible: never coloured by the ramp, only the active one lifts. -->
	<div class="flex gap-px">
		{#each BRACKETS as bracket, i (bracket.min)}
			<div
				class="truncate text-center text-[10px] leading-none tabular-nums {activeBracketIndex === i
					? 'font-semibold text-foreground'
					: 'text-muted-foreground/70'}"
				style="width: {widthPct(bracket)}%"
			>
				{bracket.label}
			</div>
		{/each}
	</div>
</div>
