<script lang="ts">
	import { getCalculatorState } from '../calculator.svelte';
	import PercentageSlider from '#lib/components/inputs/percentage-slider.svelte';
	import FrequencySelect from '#lib/components/inputs/frequency-select.svelte';
	import CurrencyInput from '#lib/components/inputs/currency-input.svelte';
	import Label from '$ui/label/label.svelte';
	import { Button } from '#lib/components/ui/button/index.js';
	import Explainer from '$ui/explainer.svelte';
	import Slider from '$ui/slider/slider.svelte';

	let calculator = getCalculatorState();
</script>

<aside class="min-w-75 max-w-250 space-y-4">
	<div class="flex items-center justify-between border-b pb-3">
		<h2 class="heading-secondary">Inputs</h2>
		<div class="flex rounded-md border border-border text-xs font-medium overflow-hidden">
			<button
				onclick={() => (calculator.mode = 'savings')}
				class="px-3 py-1.5 transition-colors {calculator.mode === 'savings'
					? 'bg-primary text-primary-foreground'
					: 'text-muted-foreground hover:text-foreground'}"
			>
				Savings
			</button>
			<button
				onclick={() => (calculator.mode = 'fire')}
				class="px-3 py-1.5 transition-colors {calculator.mode === 'fire'
					? 'bg-primary text-primary-foreground'
					: 'text-muted-foreground hover:text-foreground'}"
			>
				FIRE
			</button>
		</div>
	</div>

	<div>
		<Label for="principal">Starting Amount</Label>
		<CurrencyInput bind:value={calculator.principal} id="principal" />
	</div>

	<div class="grid grid-cols-2 gap-2">
		<div>
			<Label for="contributions">Contributions</Label>
			<CurrencyInput id="contributions" bind:value={calculator.contributionAmount} />
		</div>
		<div>
			<Label for="frequency">Frequency</Label>
			<FrequencySelect
				bind:value={calculator.contributionFrequency}
				id="frequency"
				name="frequency"
			/>
		</div>
	</div>

	<PercentageSlider
		label="Investment Return (p.a.)"
		bind:value={calculator.returnRate}
		min={0.01}
		max={0.15}
		step={0.005}
		id="interest-rate"
		explainer="Expected annual return on investments"
		precision={1}
	/>

	<div>
		<div class="flex gap-2 mb-2 items-center">
			<Label class="mb-0" id="years-invested">Years Invested</Label>
			<Explainer text="The number of years you plan to invest." />
		</div>
		<Slider
			type="single"
			bind:value={calculator.years}
			min={1}
			max={100}
			step={1}
			id="years-invested"
		/>
		<div class="text-sm text-muted-foreground mt-1">{calculator.years}</div>
	</div>

	<hr class="border-border" />

	{#if calculator.mode === 'savings'}
		<div>
			<Label for="savings-goal">Savings Goal</Label>
			<CurrencyInput bind:value={calculator.savingsGoal} id="savings-goal" />
			{#if calculator.savingsGoal <= 0}
				<p class="text-destructive text-xs mt-1">Savings goal must be greater than 0.</p>
			{/if}
		</div>
	{:else}
		<div>
			<Label for="annual-expenses">Annual Expenses</Label>
			<CurrencyInput bind:value={calculator.annualExpenses} id="annual-expenses" />
			{#if calculator.annualExpenses <= 0}
				<p class="text-destructive text-xs mt-1">Annual expenses must be greater than 0.</p>
			{/if}
		</div>

		<PercentageSlider
			label="Withdrawal Rate"
			bind:value={calculator.withdrawalRate}
			min={0.02}
			max={0.1}
			step={0.005}
			id="withdrawal-rate"
			explainer="Safe withdrawal rate for FIRE (usually 4%)"
			precision={2}
		/>

		<div>
			<Label for="secondary-income">Secondary Income (optional)</Label>
			<CurrencyInput bind:value={calculator.secondaryIncome} id="secondary-income" />
		</div>
	{/if}

	<hr class="border-border" />

	<Button
		class="w-full"
		variant="secondary"
		size="sm"
		onclick={() => (calculator.useVolatility = !calculator.useVolatility)}
	>
		{calculator.useVolatility ? 'Hide Volatility' : 'Add Volatility'}
		<Explainer text="Include market volatility for more realistic returns." />
	</Button>

	{#if calculator.useVolatility}
		<PercentageSlider
			label="Volatility (Standard Deviation)"
			bind:value={calculator.volatility}
			min={0.05}
			max={0.4}
			step={0.01}
			id="volatility"
			explainer="Stock markets typically have 15-20% volatility."
			precision={0}
		/>
	{/if}
</aside>
