import { FREQUENCIES, type FrequencyType } from '#lib/constants/frequencies.js';
import { setContext, getContext } from 'svelte';
import {
	calculateCompoundInterest,
	calculateBandData,
	buildTableData
} from '#lib/utils/growth-calculations.js';

export type Mode = 'savings' | 'fire';
export type { GrowthResult, AnnualData } from '#lib/utils/growth-calculations.js';

class SavingsCalculatorState {
	mode = $state<Mode>('savings');

	principal = $state(10000);
	years = $state(10);
	contributionAmount = $state(1000);
	contributionFrequency = $state<FrequencyType>('monthly');
	returnRate = $state(0.07);
	useVolatility = $state(false);
	volatility = $state(0.15);

	// Savings mode
	savingsGoal = $state(100000);

	// FIRE mode
	annualExpenses = $state(60000);
	withdrawalRate = $state(0.04);
	secondaryIncome = $state(0);

	goal = $derived(
		this.mode === 'fire'
			? (this.annualExpenses - this.secondaryIncome) / this.withdrawalRate
			: this.savingsGoal
	);

	result = $derived(
		calculateCompoundInterest(
			this.principal,
			this.returnRate,
			this.years,
			this.contributionAmount,
			FREQUENCIES[this.contributionFrequency].value,
			this.useVolatility ? this.volatility : 0
		)
	);

	yearsToGoal = $derived.by(() => {
		const i = this.result.annualData.findIndex((d) => d.endingValue >= this.goal);
		return i === -1 ? null : i + 1;
	});

	bandData = $derived(
		this.useVolatility
			? calculateBandData(
					this.principal,
					this.returnRate,
					this.years,
					this.contributionAmount,
					FREQUENCIES[this.contributionFrequency].value,
					this.volatility
				)
			: null
	);

	getTableData() {
		return buildTableData(this.result.annualData, this.useVolatility);
	}
}

const KEY = Symbol('savings-calculator');

export function setCalculatorState() {
	return setContext(KEY, new SavingsCalculatorState());
}

export function getCalculatorState() {
	return getContext<SavingsCalculatorState>(KEY);
}
