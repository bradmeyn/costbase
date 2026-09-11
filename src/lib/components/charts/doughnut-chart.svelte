<script lang="ts">
	import { PieChart } from 'layerchart';
	import { COLOURS } from '#lib/constants/colours.js';
	import { LC_TOOLTIP_PROPS } from '$constants/chart-config';

	let {
		data,
		formatter
	}: {
		data: { label: string; value: number }[];
		formatter: (value: number) => string;
	} = $props();

	let cRange = $derived(data.map((_, i) => COLOURS[i % COLOURS.length]));
</script>

<div class="w-full relative h-55 md:h-60 min-w-50">
	<PieChart
		{data}
		key="label"
		value="value"
		{cRange}
		innerRadius={-24}
		cornerRadius={3}
		padAngle={0.02}
		props={{
			tooltip: {
				...LC_TOOLTIP_PROPS,
				item: {
					...LC_TOOLTIP_PROPS.item,
					format: (value: unknown) => formatter(Number(value))
				}
			}
		}}
	/>
</div>
