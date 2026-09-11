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

	// Colors: light → dark green scale
	const COLORS = [
		'oklch(0.88 0.06 152)',
		'oklch(0.72 0.10 152)',
		'oklch(0.57 0.13 152)',
		'oklch(0.44 0.12 152)',
		'oklch(0.33 0.10 152)'
	];

	let taxableIncome = $derived(calc.result.taxableIncome);

	let activeBracketIndex = $derived(
		taxableIncome <= 0 ? -1 : BRACKETS.findIndex((b) => taxableIncome <= b.max)
	);

	let markerPct = $derived(
		taxableIncome <= 0 ? 0 : (Math.min(taxableIncome, MAX_DISPLAY) / MAX_DISPLAY) * 100
	);

	function widthPct(b: (typeof BRACKETS)[number]): number {
		return ((b.max - b.min) / MAX_DISPLAY) * 100;
	}
</script>

<div class="space-y-1">
	<div class="flex items-center justify-between text-xs text-muted-foreground mb-1">
		<span>Tax Brackets {taxableIncome > MAX_DISPLAY ? '(capped at $250k)' : ''}</span>
		{#if activeBracketIndex >= 0}
			<span class="font-medium" style="color: {COLORS[activeBracketIndex]}">
				{BRACKETS[activeBracketIndex].label} bracket
			</span>
		{/if}
	</div>

	<!-- Bar -->
	<div class="relative">
		<!-- Segments -->
		<div class="flex h-5 rounded-md overflow-hidden">
			{#each BRACKETS as bracket, i}
				<div
					class="h-full transition-opacity duration-200 {activeBracketIndex === i
						? 'opacity-100'
						: activeBracketIndex === -1
							? 'opacity-60'
							: 'opacity-40'}"
					style="width: {widthPct(bracket)}%; background-color: {COLORS[i]};"
					title="{bracket.label} — {formatCurrency(bracket.min)} to {bracket.max === MAX_DISPLAY
						? formatCurrency(bracket.min) + '+'
						: formatCurrency(bracket.max)}"
				></div>
			{/each}
		</div>

		<!-- Marker -->
		{#if taxableIncome > 0}
			<div
				class="absolute top-0 h-5 w-0.5 bg-foreground/80"
				style="left: {markerPct}%; transform: translateX(-50%);"
			>
				<!-- Triangle pointer below -->
				<div
					class="absolute -bottom-2 left-1/2 -translate-x-1/2 border-t-4 border-x-4 border-x-transparent border-t-foreground/80"
				></div>
			</div>
		{/if}
	</div>

	<!-- Threshold labels -->
	<div class="relative h-4">
		{#each BRACKETS as bracket, i}
			{#if i > 0}
				<span
					class="absolute text-[10px] text-muted-foreground -translate-x-1/2 whitespace-nowrap"
					style="left: {((bracket.min - 1) / MAX_DISPLAY) * 100}%"
				>
					{formatCurrency(bracket.min - 1)}
				</span>
			{/if}
		{/each}
	</div>

	<!-- Rate labels -->
	<div class="flex mt-0.5">
		{#each BRACKETS as bracket, i}
			<div
				class="text-[10px] font-medium text-center leading-none truncate"
				style="width: {widthPct(bracket)}%; color: {COLORS[i]}; opacity: {activeBracketIndex === i
					? 1
					: 0.6};"
			>
				{bracket.label}
			</div>
		{/each}
	</div>
</div>
