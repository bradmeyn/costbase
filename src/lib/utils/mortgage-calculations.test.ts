import { describe, it, expect } from 'vitest';
import {
	calculatePayment,
	calculatePrincipalAndInterest,
	calculateInterestOnly,
	calculateVariable,
	buildScheduleData
} from './mortgage-calculations';

const BASE = {
	principal: 500_000,
	interestRate: 0.06,
	periodsPerYear: 12,
	term: 30,
	extraRepayments: 0,
	propertyValue: 0,
	propertyGrowthRate: 0.03
};

describe('calculatePayment', () => {
	it('returns correct monthly payment', () => {
		// Standard mortgage formula: ~$2,997.75/month for $500k at 6% over 30yr
		const periodRate = 0.06 / 12;
		const periods = 30 * 12;
		const payment = calculatePayment(500_000, periodRate, periods);
		expect(payment).toBeCloseTo(2997.75, 0);
	});

	it('returns principal / periods when rate is 0', () => {
		expect(calculatePayment(120_000, 0, 120)).toBeCloseTo(1000, 2);
	});
});

describe('calculatePrincipalAndInterest', () => {
	const periodRate = BASE.interestRate / BASE.periodsPerYear;
	const totalPeriods = BASE.term * BASE.periodsPerYear;

	it('balance reaches zero by end of term', () => {
		const result = calculatePrincipalAndInterest(
			BASE.principal,
			periodRate,
			totalPeriods,
			BASE.periodsPerYear,
			0,
			0,
			BASE.propertyGrowthRate
		);
		expect(result.remainingPrincipal).toBeCloseTo(0, 0);
	});

	it('repayment matches calculatePayment', () => {
		const result = calculatePrincipalAndInterest(
			BASE.principal,
			periodRate,
			totalPeriods,
			BASE.periodsPerYear,
			0,
			0,
			BASE.propertyGrowthRate
		);
		expect(result.repayment).toBeCloseTo(
			calculatePayment(BASE.principal, periodRate, totalPeriods),
			2
		);
	});

	it('produces correct number of breakdown periods', () => {
		const result = calculatePrincipalAndInterest(
			BASE.principal,
			periodRate,
			totalPeriods,
			BASE.periodsPerYear,
			0,
			0,
			BASE.propertyGrowthRate
		);
		expect(result.breakdown).toHaveLength(totalPeriods);
	});

	it('extra repayments reduce total interest paid', () => {
		const without = calculatePrincipalAndInterest(
			BASE.principal,
			periodRate,
			totalPeriods,
			BASE.periodsPerYear,
			0,
			0,
			BASE.propertyGrowthRate
		);
		const withExtra = calculatePrincipalAndInterest(
			BASE.principal,
			periodRate,
			totalPeriods,
			BASE.periodsPerYear,
			500,
			0,
			BASE.propertyGrowthRate
		);
		expect(withExtra.totalInterest).toBeLessThan(without.totalInterest);
	});

	it('extra repayments shorten the loan term', () => {
		const without = calculatePrincipalAndInterest(
			BASE.principal,
			periodRate,
			totalPeriods,
			BASE.periodsPerYear,
			0,
			0,
			BASE.propertyGrowthRate
		);
		const withExtra = calculatePrincipalAndInterest(
			BASE.principal,
			periodRate,
			totalPeriods,
			BASE.periodsPerYear,
			500,
			0,
			BASE.propertyGrowthRate
		);
		expect(withExtra.breakdown.length).toBeLessThan(without.breakdown.length);
	});

	it('balance never goes negative', () => {
		const result = calculatePrincipalAndInterest(
			BASE.principal,
			periodRate,
			totalPeriods,
			BASE.periodsPerYear,
			500,
			0,
			BASE.propertyGrowthRate
		);
		result.breakdown.forEach(({ balance }) => {
			expect(balance).toBeGreaterThanOrEqual(0);
		});
	});

	it('tracks property value when provided', () => {
		const result = calculatePrincipalAndInterest(
			BASE.principal,
			periodRate,
			totalPeriods,
			BASE.periodsPerYear,
			0,
			700_000,
			BASE.propertyGrowthRate
		);
		expect(result.breakdown[0].propertyValue).toBeGreaterThan(700_000);
	});

	it('ioRepayment is 0', () => {
		const result = calculatePrincipalAndInterest(
			BASE.principal,
			periodRate,
			totalPeriods,
			BASE.periodsPerYear,
			0,
			0,
			BASE.propertyGrowthRate
		);
		expect(result.ioRepayment).toBe(0);
	});
});

describe('calculateInterestOnly', () => {
	const ioPeriods = 3 * 12; // 3 year IO period
	const totalPeriods = 30 * 12;
	const periodRate = 0.06 / 12;

	it('principal is 0 for all IO period breakdown entries', () => {
		const result = calculateInterestOnly(
			BASE.principal,
			0.055,
			ioPeriods,
			totalPeriods,
			BASE.periodsPerYear,
			periodRate,
			0,
			0,
			BASE.propertyGrowthRate
		);
		result.breakdown.slice(0, ioPeriods).forEach(({ principal }) => {
			expect(principal).toBe(0);
		});
	});

	it('balance stays at principal throughout IO period (no extra repayments)', () => {
		const result = calculateInterestOnly(
			BASE.principal,
			0.055,
			ioPeriods,
			totalPeriods,
			BASE.periodsPerYear,
			periodRate,
			0,
			0,
			BASE.propertyGrowthRate
		);
		result.breakdown.slice(0, ioPeriods).forEach(({ balance }) => {
			expect(balance).toBeCloseTo(BASE.principal, 0);
		});
	});

	it('transitions to P&I phase and balance reaches zero', () => {
		const result = calculateInterestOnly(
			BASE.principal,
			0.055,
			ioPeriods,
			totalPeriods,
			BASE.periodsPerYear,
			periodRate,
			0,
			0,
			BASE.propertyGrowthRate
		);
		expect(result.remainingPrincipal).toBeCloseTo(0, 0);
	});

	it('ioRepayment is greater than 0', () => {
		const result = calculateInterestOnly(
			BASE.principal,
			0.055,
			ioPeriods,
			totalPeriods,
			BASE.periodsPerYear,
			periodRate,
			0,
			0,
			BASE.propertyGrowthRate
		);
		expect(result.ioRepayment).toBeGreaterThan(0);
	});

	it('IO loan has higher total interest than equivalent P&I loan', () => {
		const piResult = calculatePrincipalAndInterest(
			BASE.principal,
			periodRate,
			totalPeriods,
			BASE.periodsPerYear,
			0,
			0,
			BASE.propertyGrowthRate
		);
		const ioResult = calculateInterestOnly(
			BASE.principal,
			0.06,
			ioPeriods,
			totalPeriods,
			BASE.periodsPerYear,
			periodRate,
			0,
			0,
			BASE.propertyGrowthRate
		);
		expect(ioResult.totalInterest).toBeGreaterThan(piResult.totalInterest);
	});
});

describe('calculateVariable', () => {
	const totalPeriods = 30 * 12;
	const fixedPeriods = 3 * 12;

	it('produces breakdown covering full loan term', () => {
		const result = calculateVariable(
			BASE.principal,
			0.06,
			0.08,
			totalPeriods,
			BASE.periodsPerYear,
			fixedPeriods,
			0,
			0,
			BASE.propertyGrowthRate
		);
		expect(result.remainingPrincipal).toBeCloseTo(0, 0);
	});

	it('repayment reflects fixed rate payment', () => {
		const fixedPeriodRate = 0.06 / 12;
		const expected = calculatePayment(BASE.principal, fixedPeriodRate, totalPeriods);
		const result = calculateVariable(
			BASE.principal,
			0.06,
			0.08,
			totalPeriods,
			BASE.periodsPerYear,
			fixedPeriods,
			0,
			0,
			BASE.propertyGrowthRate
		);
		expect(result.repayment).toBeCloseTo(expected, 2);
	});

	it('higher variable rate increases total interest vs same fixed rate', () => {
		const allFixed = calculatePrincipalAndInterest(
			BASE.principal,
			0.06 / 12,
			totalPeriods,
			BASE.periodsPerYear,
			0,
			0,
			BASE.propertyGrowthRate
		);
		const variable = calculateVariable(
			BASE.principal,
			0.06,
			0.09,
			totalPeriods,
			BASE.periodsPerYear,
			fixedPeriods,
			0,
			0,
			BASE.propertyGrowthRate
		);
		expect(variable.totalInterest).toBeGreaterThan(allFixed.totalInterest);
	});

	it('balance never goes negative', () => {
		const result = calculateVariable(
			BASE.principal,
			0.06,
			0.08,
			totalPeriods,
			BASE.periodsPerYear,
			fixedPeriods,
			500,
			0,
			BASE.propertyGrowthRate
		);
		result.breakdown.forEach(({ balance }) => {
			expect(balance).toBeGreaterThanOrEqual(0);
		});
	});
});

describe('buildScheduleData', () => {
	const result = calculatePrincipalAndInterest(500_000, 0.06 / 12, 30 * 12, 12, 0, 0, 0.03);

	it('returns correct column count without property', () => {
		const { columns } = buildScheduleData(result.breakdown, false);
		expect(columns).toHaveLength(6);
	});

	it('returns correct column count with property', () => {
		const { columns } = buildScheduleData(result.breakdown, true);
		expect(columns).toHaveLength(7);
	});

	it('rows match breakdown length', () => {
		const { rows } = buildScheduleData(result.breakdown, false);
		expect(rows).toHaveLength(result.breakdown.length);
	});

	it('first column is period number', () => {
		const { rows } = buildScheduleData(result.breakdown, false);
		rows.forEach((row, i) => {
			expect(row[0]).toBe(i + 1);
		});
	});

	it('currency columns are formatted strings', () => {
		const { rows } = buildScheduleData(result.breakdown, false);
		rows.forEach((row) => {
			expect(typeof row[1]).toBe('string');
			expect(row[1]).toMatch(/^\$/);
		});
	});
});
