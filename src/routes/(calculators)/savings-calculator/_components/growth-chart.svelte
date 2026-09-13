<script lang="ts">
	import { LineChart, Tooltip } from 'layerchart';
	import { formatCurrency } from '#lib/utils/formatters.js';
	import type { AnnualData } from '../calculator.svelte';
	import { COLOURS } from '#lib/constants/colours.js';
	import { LC_TOOLTIP_PROPS, LC_AXIS_PROPS, LC_GRID } from '$constants/chart-config';

	let {
		annualData = [],
		savingsGoal,
		bandData = null
	}: {
		annualData: AnnualData[];
		savingsGoal: number;
		bandData?: { year: number; low: number; high: number }[] | null;
	} = $props();

	let chartData = $derived(
		annualData.map((item, i) => ({
			...item,
			goal: savingsGoal || null,
			bandLow: bandData?.[i]?.low ?? null,
			bandHigh: bandData?.[i]?.high ?? null
		}))
	);

	let series = $derived.by(() => {
		const baseColor = COLOURS[0];
		// green (tertiary) reads as a target; orange is reserved for tax owed elsewhere
		const goalColor = COLOURS[2];
		const bandColor = COLOURS[0];

		const result = [];

		if (bandData) {
			result.push(
				{
					key: 'bandHigh',
					label: 'Optimistic',
					color: bandColor,
					props: {
						style: `stroke: ${bandColor}; fill: none; stroke-dasharray: 4 4; opacity: 0.35;`,
						strokeWidth: 1.5
					}
				},
				{
					key: 'bandLow',
					label: 'Pessimistic',
					color: bandColor,
					props: {
						style: `stroke: ${bandColor}; fill: none; stroke-dasharray: 4 4; opacity: 0.35;`,
						strokeWidth: 1.5
					}
				}
			);
		}

		result.push({
			key: 'endingValue',
			label: 'Value',
			color: baseColor,
			props: {
				style: `stroke: ${baseColor}; fill: none; stroke-linecap: round; stroke-linejoin: round;`,
				strokeWidth: 3
			}
		});

		if (savingsGoal) {
			result.push({
				key: 'goal',
				label: 'Goal',
				color: goalColor,
				props: {
					style: `stroke: ${goalColor}; fill: none; stroke-linecap: round; stroke-linejoin: round; stroke-dasharray: 7 6;`,
					strokeWidth: 2
				}
			});
		}

		return result;
	});
</script>

<div class="relative h-100 min-w-50 overflow-hidden pt-2 md:h-80 lg:h-100">
	<LineChart
		data={chartData}
		x="year"
		y="endingValue"
		{series}
		grid={LC_GRID}
		legend={{ placement: 'top', variant: 'swatches' }}
		points={false}
		padding={{ left: 60, right: 20, top: 40, bottom: 40 }}
		props={{
			xAxis: {
				...LC_AXIS_PROPS,
				label: 'Year',
				format: (value: unknown) => String(Math.round(Number(value)))
			},
			yAxis: {
				...LC_AXIS_PROPS,
				format: (value: unknown) => formatCurrency(Number(value), false)
			},
			legend: {
				classes: { label: 'text-foreground text-sm', swatch: 'size-2.5' }
			}
		}}
	>
		{#snippet tooltip({ context })}
			<Tooltip.Root {context} {...LC_TOOLTIP_PROPS.root}>
				{#snippet children({ data }: { data: Record<string, number> })}
					<Tooltip.Header
						value={`Year ${Math.round(Number(data.year))}`}
						{...LC_TOOLTIP_PROPS.header}
					/>
					<Tooltip.List>
						{#each series as s (s.key)}
							<Tooltip.Item
								label={s.label}
								value={data[s.key]}
								color={s.color}
								format={(v: unknown) => formatCurrency(Number(v), false)}
								valueAlign="right"
								{...LC_TOOLTIP_PROPS.item}
							/>
						{/each}
					</Tooltip.List>
				{/snippet}
			</Tooltip.Root>
		{/snippet}
	</LineChart>
</div>
