import { formatCurrency, formatPercentage } from '#lib/utils/formatters.js';

export type GrowthResult = {
	totalValue: number;
	totalInterest: number;
	totalContributions: number;
	annualData: AnnualData[];
};

export type AnnualData = {
	year: number;
	startingValue: number;
	yearlyInterest: number;
	actualReturn: number;
	totalInterest: number;
	yearlyContribution: number;
	totalContributions: number;
	endingValue: number;
};

function generateNormalRandom(): number {
	let u1 = 0,
		u2 = 0;
	while (u1 === 0) u1 = Math.random();
	while (u2 === 0) u2 = Math.random();
	return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

function generateRandomReturn(expectedReturn: number, volatility: number): number {
	return expectedReturn + generateNormalRandom() * volatility;
}

export function calculateCompoundInterest(
	principal: number,
	interestRate: number,
	years: number,
	contributionAmount: number,
	contributionFrequency: number,
	volatility: number = 0
): GrowthResult {
	if (principal <= 0 || interestRate <= 0 || years <= 0 || contributionFrequency < 0) {
		return { totalValue: 0, totalInterest: 0, totalContributions: 0, annualData: [] };
	}

	let totalValue = principal;
	let totalInterest = 0;
	let totalContributions = 0;
	const annualData = [];

	for (let i = 0; i < years; i++) {
		const startingValue = parseFloat(totalValue.toFixed(2));
		const actualReturn =
			volatility > 0 ? generateRandomReturn(interestRate, volatility) : interestRate;
		const clampedReturn = Math.max(actualReturn, -1);
		const yearlyInterest = totalValue * clampedReturn;
		totalInterest += yearlyInterest;
		const yearlyContribution = contributionAmount * contributionFrequency;
		totalContributions += yearlyContribution;
		totalValue = Math.max(totalValue + yearlyInterest + yearlyContribution, 0);

		annualData.push({
			year: i + 1,
			startingValue,
			yearlyInterest: parseFloat(yearlyInterest.toFixed(2)),
			actualReturn: parseFloat(clampedReturn.toFixed(4)),
			totalInterest: parseFloat(totalInterest.toFixed(2)),
			yearlyContribution: parseFloat(yearlyContribution.toFixed(2)),
			totalContributions: parseFloat(totalContributions.toFixed(2)),
			endingValue: parseFloat(totalValue.toFixed(2))
		});
	}

	return { totalValue, totalInterest, totalContributions, annualData };
}

export function calculateBandData(
	principal: number,
	returnRate: number,
	years: number,
	contributionAmount: number,
	contributionFrequency: number,
	volatility: number
): { year: number; low: number; high: number }[] | null {
	if (years <= 0 || principal <= 0) return null;

	const simCount = 200;
	const valuesByYear: number[][] = Array.from({ length: years }, () => []);

	for (let s = 0; s < simCount; s++) {
		let value = principal;
		for (let y = 0; y < years; y++) {
			const r = Math.max(generateRandomReturn(returnRate, volatility), -1);
			value = Math.max(value + value * r + contributionAmount * contributionFrequency, 0);
			valuesByYear[y].push(value);
		}
	}

	return valuesByYear.map((values, i) => {
		values.sort((a, b) => a - b);
		return {
			year: i + 1,
			low: values[Math.floor(simCount * 0.1)],
			high: values[Math.floor(simCount * 0.9)]
		};
	});
}

export function buildTableData(annualData: AnnualData[], useVolatility: boolean) {
	const columns = useVolatility
		? [
				'Year',
				'Starting Value',
				'Actual Return %',
				'Interest Earned',
				'Annual Contribution',
				'Total Value'
			]
		: ['Year', 'Starting Value', 'Interest Earned', 'Annual Contribution', 'Total Value'];

	return {
		columns,
		rows: annualData.map((data) => {
			const row = [
				data.year,
				formatCurrency(data.startingValue),
				formatCurrency(data.yearlyInterest),
				formatCurrency(data.yearlyContribution),
				formatCurrency(data.endingValue)
			];
			if (useVolatility) row.splice(2, 0, formatPercentage(data.actualReturn));
			return row;
		})
	};
}
