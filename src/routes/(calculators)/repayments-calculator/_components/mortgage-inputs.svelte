<script lang="ts">
	import { getCalculatorState } from '../calculator.svelte';
	import PercentageSlider from '#lib/components/inputs/percentage-slider.svelte';
	import CurrencyInput from '#lib/components/inputs/currency-input.svelte';
	import Label from '$ui/label/label.svelte';
	import * as Select from '#lib/components/ui/select/index.js';
	import { Button } from '#lib/components/ui/button/index.js';
	import TabSelect from '#lib/components/inputs/tab-select.svelte';
	import Slider from '$ui/slider/slider.svelte';
	import Explainer from '$ui/explainer.svelte';
	import { FREQUENCIES } from '#lib/constants/frequencies.js';

	let calc = getCalculatorState();

	const loanTypeOptions = [
		{ value: 'Principal & Interest', label: 'P & I' },
		{ value: 'Interest Only', label: 'Interest Only' },
		{ value: 'Variable', label: 'Fixed' }
	];

	const ioTermOptions = Array.from({ length: 5 }, (_, i) => ({
		value: String(i + 1),
		label: `${i + 1} yr${i > 0 ? 's' : ''}`
	}));

	const fixedTermOptions = Array.from({ length: 5 }, (_, i) => ({
		value: String(i + 1),
		label: `${i + 1} yr${i > 0 ? 's' : ''}`
	}));

	let ioTermStr = $state(String(calc.ioTerm));
	let fixedTermStr = $state(String(calc.fixedTerm));

	$effect(() => {
		calc.ioTerm = Number(ioTermStr);
	});
	$effect(() => {
		calc.fixedTerm = Number(fixedTermStr);
	});

	let includeProperty = $state(false);

	function toggleProperty() {
		calc.propertyValue = includeProperty ? 0 : 800_000;
		includeProperty = !includeProperty;
	}

	const principalError = $derived(calc.principal <= 0 ? 'Loan amount is required.' : '');
</script>

<aside class="min-w-75 max-w-250 space-y-4">
	<h2 class="heading-secondary border-b pb-3">Inputs</h2>

	<div>
		<Label for="principal">Loan Amount</Label>
		<CurrencyInput bind:value={calc.principal} id="principal" />
		{#if principalError}<p class="text-destructive text-xs mt-1">{principalError}</p>{/if}
	</div>

	<PercentageSlider
		label="Interest Rate (p.a.)"
		bind:value={calc.interestRate}
		min={0.01}
		max={0.15}
		step={0.0025}
		id="interest-rate"
		explainer="Annual interest rate on your loan"
		precision={2}
	/>

	<div>
		<div class="flex gap-2 mb-2 items-center">
			<Label class="mb-0" for="term">Loan Term</Label>
		</div>
		<Slider type="single" bind:value={calc.term} min={1} max={30} step={1} id="term" />
		<p class="text-sm text-muted-foreground mt-1">
			{calc.term}
			{calc.term === 1 ? 'year' : 'years'}
		</p>
	</div>

	<div>
		<Label for="repayment-frequency">Repayment Frequency</Label>
		<Select.Root name="repayment-frequency" type="single" bind:value={calc.frequency}>
			<Select.Trigger id="repayment-frequency">
				{FREQUENCIES[calc.frequency].label}
			</Select.Trigger>
			<Select.Content>
				<Select.Item value="weekly">Weekly</Select.Item>
				<Select.Item value="fortnightly">Fortnightly</Select.Item>
				<Select.Item value="monthly">Monthly</Select.Item>
			</Select.Content>
		</Select.Root>
	</div>

	<div>
		<div class="flex gap-2 items-center mb-1">
			<Label class="mb-0" for="extra-repayments">Extra Repayments</Label>
			<Explainer text="Additional amount paid each period on top of the minimum repayment." />
		</div>
		<CurrencyInput bind:value={calc.extraRepayments} id="extra-repayments" />
	</div>

	<hr class="border-border" />

	<div>
		<Label>Loan Type</Label>
		<TabSelect bind:value={calc.loanType} options={loanTypeOptions} name="loan-type" />
	</div>

	{#if calc.loanType === 'Interest Only'}
		<PercentageSlider
			label="Interest Only Rate (p.a.)"
			bind:value={calc.ioRate}
			min={0.01}
			max={0.15}
			step={0.0025}
			id="io-rate"
			explainer="Interest rate during the interest-only period"
			precision={2}
		/>
		<div>
			<Label>Interest Only Period</Label>
			<TabSelect bind:value={ioTermStr} options={ioTermOptions} name="io-term" />
		</div>
	{/if}

	{#if calc.loanType === 'Variable'}
		<div>
			<Label>Fixed Period</Label>
			<TabSelect bind:value={fixedTermStr} options={fixedTermOptions} name="fixed-term" />
		</div>
		<PercentageSlider
			label="Variable Rate (p.a.)"
			bind:value={calc.variableRate}
			min={0.01}
			max={0.15}
			step={0.0025}
			id="variable-rate"
			explainer="Rate after the fixed period ends"
			precision={2}
		/>
	{/if}

	<hr class="border-border" />

	<Button class="w-full" variant="secondary" size="sm" onclick={toggleProperty}>
		{includeProperty ? 'Hide Property' : 'Include Property Value'}
	</Button>

	{#if includeProperty}
		<div>
			<Label for="property-value">Property Value</Label>
			<CurrencyInput bind:value={calc.propertyValue} id="property-value" />
		</div>
		<PercentageSlider
			label="Property Growth (p.a.)"
			bind:value={calc.propertyGrowthRate}
			min={0}
			max={0.1}
			step={0.005}
			id="property-growth"
			explainer="Expected annual property value growth"
			precision={1}
		/>
	{/if}
</aside>
