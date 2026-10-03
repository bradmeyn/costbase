import { FREQUENCIES, type FrequencyType } from '#lib/constants/frequencies.js';
import { setContext, getContext } from 'svelte';
import { formatCurrency, formatPercentage } from '#lib/utils/formatters.js';
import { calculatePersonalTax, type TaxResult } from './tax-rates';

const EMPTY_RESULT: TaxResult = {
	taxableIncome: 0,
	incomeTax: 0,
	lowIncomeOffset: 0,
	medicareLevy: 0,
	medicareLevySurcharge: 0,
	helpRepayment: 0,
	totalTax: 0
};

class TaxCalculatorState {
	income = $state(100_000);
	incomeFrequency = $state<FrequencyType>('annually');
	deductions = $state(0);
	hasInsurance = $state(false);
	hasHelpDebt = $state(false);

	annualIncome = $derived(this.income * FREQUENCIES[this.incomeFrequency].value);

	result = $derived.by(() => {
		if (this.annualIncome <= 0) return EMPTY_RESULT;
		return calculatePersonalTax(
			this.annualIncome,
			this.deductions,
			this.hasInsurance,
			this.hasHelpDebt
		);
	});

	takeHomePay = $derived(Math.max(0, this.annualIncome - this.result.totalTax));
	effectiveRate = $derived(this.annualIncome > 0 ? this.result.totalTax / this.annualIncome : 0);

	chartData = $derived.by(() => {
		const items = [
			{ label: 'Income Tax', value: this.result.incomeTax },
			{ label: 'Medicare Levy', value: this.result.medicareLevy },
			{ label: 'Medicare Levy Surcharge', value: this.result.medicareLevySurcharge },
			{ label: 'HELP Repayment', value: this.result.helpRepayment }
		];
		return items.filter((item) => item.value > 0);
	});

	getTableData() {
		const rows: (string | number)[][] = [
			['Annual Income', formatCurrency(this.annualIncome)],
			['Deductions', formatCurrency(this.deductions)],
			['Taxable Income', formatCurrency(this.result.taxableIncome)],
			['Income Tax', formatCurrency(this.result.incomeTax)],
			['Low Income Tax Offset', formatCurrency(this.result.lowIncomeOffset)],
			['Medicare Levy', formatCurrency(this.result.medicareLevy)]
		];

		if (this.result.medicareLevySurcharge > 0) {
			rows.push(['Medicare Levy Surcharge', formatCurrency(this.result.medicareLevySurcharge)]);
		}
		if (this.result.helpRepayment > 0) {
			rows.push(['HELP Repayment', formatCurrency(this.result.helpRepayment)]);
		}

		rows.push(
			['Total Tax', formatCurrency(this.result.totalTax)],
			['Effective Tax Rate', formatPercentage(this.effectiveRate)],
			['Take-Home Pay', formatCurrency(this.takeHomePay)]
		);

		return {
			columns: ['Item', 'Amount'],
			rows
		};
	}
}

const CALCULATOR_KEY = Symbol('tax-calculator');

export function setCalculatorState() {
	return setContext(CALCULATOR_KEY, new TaxCalculatorState());
}

export function getCalculatorState() {
	return getContext<TaxCalculatorState>(CALCULATOR_KEY);
}
