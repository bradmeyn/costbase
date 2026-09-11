<script lang="ts">
	import { LineChart, Tooltip } from 'layerchart';
	import { formatCurrency } from '#lib/utils/formatters.js';
	import { getCalculatorState, type BreakdownPeriod } from '../calculator.svelte';
	import { COLOURS } from '#lib/constants/colours.js';
	import { LC_TOOLTIP_PROPS, LC_AXIS_PROPS, LC_GRID } from '$constants/chart-config';

	let calc = getCalculatorState();

	let chartData = $derived(
		calc.projection.breakdown.map((p: BreakdownPeriod) => ({
			period: p.period,
			balance: p.balance,
			propertyValue: calc.propertyValue > 0 ? p.propertyValue : null
		}))
	);

	let yMax = $derived(
		Math.max(...chartData.map((d) => d.balance), ...chartData.map((d) => d.propertyValue ?? 0))
	);

	let series = $derived.by(() => {
		const result = [
			{
				key: 'balance',
				label: 'Loan Balance',
				color: COLOURS[0],
				props: {
					style: `stroke: ${COLOURS[0]}; fill: none; stroke-linecap: round; stroke-linejoin: round;`,
					strokeWidth: 3
				}
			}
		];

		if (calc.propertyValue > 0) {
			result.push({
				key: 'propertyValue',
				label: 'Property Value',
				color: COLOURS[1],
				props: {
					style: `stroke: ${COLOURS[1]}; fill: none; stroke-linecap: round; stroke-linejoin: round; stroke-dasharray: 7 6;`,
					strokeWidth: 2
				}
			});
		}

		return result;
	});
</script>

<div class="h-100 relative md:h-80 min-w-50">
	<LineChart
		data={chartData}
		x="period"
		y="balance"
		yDomain={[0, yMax]}
		{series}
		grid={LC_GRID}
		legend={{ placement: 'top', variant: 'swatches' }}
		points={false}
		padding={{ top: 4, left: 80, bottom: 20, right: 4 }}
		props={{
			xAxis: {
				...LC_AXIS_PROPS,
				label: 'Period',
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
						value={`Period ${Math.round(Number(data.period))}`}
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
