import { describe, it, expect } from 'vitest';
import {
	calculateCompoundInterest,
	calculateBandData,
	buildTableData
} from './growth-calculations';

describe('calculateCompoundInterest', () => {
	it('returns zeros for invalid inputs', () => {
		expect(calculateCompoundInterest(0, 0.07, 10, 100, 12, 0)).toEqual({
			totalValue: 0,
			totalInterest: 0,
			totalContributions: 0,
			annualData: []
		});
		expect(calculateCompoundInterest(10000, 0, 10, 100, 12, 0)).toEqual({
			totalValue: 0,
			totalInterest: 0,
			totalContributions: 0,
			annualData: []
		});
		expect(calculateCompoundInterest(10000, 0.07, 0, 100, 12, 0)).toEqual({
			totalValue: 0,
			totalInterest: 0,
			totalContributions: 0,
			annualData: []
		});
	});

	it('grows principal with no contributions', () => {
		const result = calculateCompoundInterest(10000, 0.1, 1, 0, 1, 0);
		expect(result.annualData).toHaveLength(1);
		expect(result.annualData[0].endingValue).toBeCloseTo(11000, 0);
		expect(result.annualData[0].yearlyContribution).toBe(0);
		expect(result.totalContributions).toBe(0);
	});

	it('compounds correctly over multiple years', () => {
		// 10% annual return, no contributions: 10000 → 12100 after 2 years
		const result = calculateCompoundInterest(10000, 0.1, 2, 0, 1, 0);
		expect(result.annualData[1].endingValue).toBeCloseTo(12100, 0);
	});

	it('adds contributions correctly', () => {
		// 1000/year contribution, 0% return: should be principal + total contributions
		const result = calculateCompoundInterest(10000, 0.0001, 3, 1000, 1, 0);
		expect(result.totalContributions).toBeCloseTo(3000, 0);
	});

	it('returns correct number of annual data points', () => {
		const result = calculateCompoundInterest(10000, 0.07, 20, 500, 12, 0);
		expect(result.annualData).toHaveLength(20);
	});

	it('annual data year numbers are sequential', () => {
		const result = calculateCompoundInterest(10000, 0.07, 5, 0, 1, 0);
		result.annualData.forEach((d, i) => {
			expect(d.year).toBe(i + 1);
		});
	});

	it('endingValue increases each year with positive return and no contributions', () => {
		const result = calculateCompoundInterest(10000, 0.07, 10, 0, 1, 0);
		for (let i = 1; i < result.annualData.length; i++) {
			expect(result.annualData[i].endingValue).toBeGreaterThan(
				result.annualData[i - 1].endingValue
			);
		}
	});

	it('totalValue matches last annual data endingValue', () => {
		const result = calculateCompoundInterest(10000, 0.07, 10, 500, 12, 0);
		const lastYear = result.annualData[result.annualData.length - 1];
		expect(result.totalValue).toBeCloseTo(lastYear.endingValue, 1);
	});
});

describe('calculateBandData', () => {
	it('returns null for invalid inputs', () => {
		expect(calculateBandData(0, 0.07, 10, 100, 12, 0.15)).toBeNull();
		expect(calculateBandData(10000, 0.07, 0, 100, 12, 0.15)).toBeNull();
	});

	it('returns correct number of year entries', () => {
		const result = calculateBandData(10000, 0.07, 10, 500, 12, 0.15);
		expect(result).not.toBeNull();
		expect(result!).toHaveLength(10);
	});

	it('low is always less than or equal to high', () => {
		const result = calculateBandData(10000, 0.07, 10, 500, 12, 0.15);
		result!.forEach(({ low, high }) => {
			expect(low).toBeLessThanOrEqual(high);
		});
	});

	it('year numbers are sequential', () => {
		const result = calculateBandData(10000, 0.07, 5, 0, 1, 0.1);
		result!.forEach(({ year }, i) => {
			expect(year).toBe(i + 1);
		});
	});
});

describe('buildTableData', () => {
	const sampleData = calculateCompoundInterest(10000, 0.07, 3, 500, 12, 0).annualData;

	it('returns 5 columns without volatility', () => {
		const { columns } = buildTableData(sampleData, false);
		expect(columns).toHaveLength(5);
	});

	it('returns 6 columns with volatility', () => {
		const { columns } = buildTableData(sampleData, true);
		expect(columns).toHaveLength(6);
	});

	it('rows match the number of annual data entries', () => {
		const { rows } = buildTableData(sampleData, false);
		expect(rows).toHaveLength(sampleData.length);
	});

	it('first column of each row is the year number', () => {
		const { rows } = buildTableData(sampleData, false);
		rows.forEach((row, i) => {
			expect(row[0]).toBe(i + 1);
		});
	});

	it('currency values are formatted as strings', () => {
		const { rows } = buildTableData(sampleData, false);
		// columns 1–4 should be formatted currency strings
		rows.forEach((row) => {
			expect(typeof row[1]).toBe('string');
			expect(row[1]).toMatch(/^\$/);
		});
	});
});
