<!-- PercentageSlider.svelte -->
<script lang="ts">
	import Label from '$ui/label/label.svelte';
	import Slider from '$ui/slider/slider.svelte';
	import Explainer from '$ui/explainer.svelte';

	interface Props {
		label: string;
		value: number;
		min: number;
		max: number;
		step?: number;
		id: string;
		explainer?: string;
		precision?: number;
	}

	let {
		label,
		value = $bindable(),
		min,
		max,
		step = 0.001,
		id,
		explainer,
		precision = 1
	}: Props = $props();

	const formatPercentage = (val: number) => (val * 100).toFixed(precision) + '%';
	const formatRange = () => `${(min * 100).toFixed(0)}% - ${(max * 100).toFixed(0)}%`;
</script>

<div>
	<div class="mb-2 flex items-center gap-2">
		<Label class="mb-0" for={id}>{label}</Label>
		{#if explainer}
			<Explainer text={explainer} />
		{/if}
	</div>

	<Slider type="single" bind:value {min} {max} {step} {id} />

	<div class="mt-1 flex justify-between text-sm text-muted-foreground">
		<span>{formatPercentage(value)} p.a.</span>
		<span class="text-sm">{formatRange()}</span>
	</div>
</div>
