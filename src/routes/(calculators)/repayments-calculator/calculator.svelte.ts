import { FREQUENCIES } from '$constants/frequencies';
import { setContext, getContext } from 'svelte';
import {
	calculatePrincipalAndInterest,
	calculateInterestOnly,
	calculateVariable,
	buildScheduleData
} from '$utils/mortgage-calculations';

export type { LoanType, MortgageProjection, BreakdownPeriod } from '$utils/mortgage-calculations';

const REPAYMENT_FREQUENCIES = ['weekly', 'fortnightly', 'monthly'] as const;
type RepaymentFrequency = (typeof REPAYMENT_FREQUENCIES)[number];

class MortgageCalculatorState {
	principal = $state(700_000);
	interestRate = $state(0.06);
	loanType = $state<import('$utils/mortgage-calculations').LoanType>('Principal & Interest');
	term = $state(30);
	frequency = $state<RepaymentFrequency>('monthly');
	extraRepayments = $state(0);

	// Interest Only
	ioRate = $state(0.055);
	ioTerm = $state(3);

	// Variable
	variableRate = $state(0.08);
	fixedTerm = $state(3);

	// Property
	propertyValue = $state(0);
	propertyGrowthRate = $state(0.03);

	periodsPerYear = $derived(FREQUENCIES[this.frequency].value);
	totalPeriods = $derived(this.term * this.periodsPerYear);
	periodRate = $derived(this.interestRate / this.periodsPerYear);
	ioPeriods = $derived(this.ioTerm * this.periodsPerYear);
	fixedPeriods = $derived(this.fixedTerm * this.periodsPerYear);

	projection = $derived.by(() => {
		if (this.principal <= 0) {
			return {
				repayment: 0,
				ioRepayment: 0,
				totalInterest: 0,
				totalRepayment: 0,
				remainingPrincipal: 0,
				breakdown: []
			};
		}
		if (this.loanType === 'Interest Only') {
			return calculateInterestOnly(
				this.principal,
				this.ioRate,
				this.ioPeriods,
				this.totalPeriods,
				this.periodsPerYear,
				this.periodRate,
				this.extraRepayments,
				this.propertyValue,
				this.propertyGrowthRate
			);
		}
		if (this.loanType === 'Variable') {
			return calculateVariable(
				this.principal,
				this.interestRate,
				this.variableRate,
				this.totalPeriods,
				this.periodsPerYear,
				this.fixedPeriods,
				this.extraRepayments,
				this.propertyValue,
				this.propertyGrowthRate
			);
		}
		return calculatePrincipalAndInterest(
			this.principal,
			this.periodRate,
			this.totalPeriods,
			this.periodsPerYear,
			this.extraRepayments,
			this.propertyValue,
			this.propertyGrowthRate
		);
	});

	interestSaved = $derived.by(() => {
		if (this.extraRepayments <= 0) return 0;
		const withoutExtra = calculatePrincipalAndInterest(
			this.principal,
			this.periodRate,
			this.totalPeriods,
			this.periodsPerYear,
			0,
			this.propertyValue,
			this.propertyGrowthRate
		);
		return withoutExtra.totalInterest - this.projection.totalInterest;
	});

	getScheduleData() {
		return buildScheduleData(this.projection.breakdown, this.propertyValue > 0);
	}
}

const CALCULATOR_KEY = Symbol('mortgage-calculator');

export function setCalculatorState() {
	return setContext(CALCULATOR_KEY, new MortgageCalculatorState());
}

export function getCalculatorState() {
	return getContext<MortgageCalculatorState>(CALCULATOR_KEY);
}
