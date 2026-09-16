<script lang="ts">
	import { getCalculatorState } from '../calculator.svelte';
	import CurrencyInput from '#lib/components/inputs/currency-input.svelte';
	import FrequencySelect from '#lib/components/inputs/frequency-select.svelte';
	import Label from '$ui/label/label.svelte';
	import { Checkbox } from '$ui/checkbox';

	let calc = getCalculatorState();
</script>

<aside class="max-w-250 min-w-75 space-y-4">
	<h2 class="heading-secondary">Inputs</h2>

	<div class="grid grid-cols-2 gap-2">
		<div>
			<Label for="income">Income</Label>
			<CurrencyInput bind:value={calc.income} id="income" />
		</div>
		<div>
			<Label for="income-frequency">Frequency</Label>
			<FrequencySelect
				bind:value={calc.incomeFrequency}
				id="income-frequency"
				name="income-frequency"
			/>
		</div>
	</div>

	<div>
		<Label for="deductions">Deductions</Label>
		<CurrencyInput bind:value={calc.deductions} id="deductions" />
	</div>

	<hr class="border-border" />

	<div class="space-y-3">
		<div class="flex items-center gap-3">
			<Checkbox id="has-insurance" bind:checked={calc.hasInsurance} />
			<div>
				<Label for="has-insurance" class="mb-0 cursor-pointer">Private Health Insurance</Label>
				<p class="text-xs text-muted-foreground">Exempts you from Medicare Levy Surcharge</p>
			</div>
		</div>

		<div class="flex items-center gap-3">
			<Checkbox id="has-help" bind:checked={calc.hasHelpDebt} />
			<div>
				<Label for="has-help" class="mb-0 cursor-pointer">HELP / HECS Debt</Label>
				<p class="text-xs text-muted-foreground">Adds compulsory HELP repayment to your tax</p>
			</div>
		</div>
	</div>
</aside>
