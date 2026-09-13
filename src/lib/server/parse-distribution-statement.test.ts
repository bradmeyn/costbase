import { describe, it, expect } from 'vitest';
import { distributionFromRows } from './parse-distribution-statement';

/*
  Rows mirror the layout the extractor reconstructs from a Computershare statement.
  The real PDF is not committed: it carries a name, address and HIN.
*/
const statementRows = (holdings: string[][] = defaultHoldings()): string[][] => [
	['Record Date:', '2 July 2026'],
	['Payment Date:', '16 July 2026'],
	['Vanguard Distribution for the Period Ended 30 June 2026'],
	['Distribution Payment'],
	['Cash per', 'Gross Cash', 'Tax Withheld', 'Net Cash'],
	['ASX', 'Fund Name', 'Security ($)', 'Units', 'Amount ($)', 'Amount ($)', 'Amount ($)'],
	...holdings,
	['Total:', '6,198.63', '0.00', '6,198.63']
];

const defaultHoldings = (): string[][] => [
	[
		'VAS',
		'Vanguard Australian Shares Index ETF',
		'0.48829897',
		'2,845',
		'1,389.21',
		'0.00',
		'1,389.21'
	],
	[
		'VGS',
		'Vanguard MSCI Index International Shares ETF',
		'0.81543200',
		'5,898',
		'4,809.42',
		'0.00',
		'4,809.42'
	]
];

describe('distributionFromRows', () => {
	it('reads the dates and the period', () => {
		const s = distributionFromRows(statementRows());
		expect(s.recordDate).toBe('2026-07-02');
		expect(s.paymentDate).toBe('2026-07-16');
		expect(s.periodEnd).toBe('30 June 2026');
	});

	it('reads one row per holding', () => {
		const s = distributionFromRows(statementRows());
		expect(s.rows).toHaveLength(2);
		expect(s.rows[0]).toMatchObject({
			ticker: 'VAS',
			units: 2845,
			grossPayment: 138_921,
			taxWithheld: 0,
			netPayment: 138_921
		});
		expect(s.warnings).toEqual([]);
		expect(s.rows.flatMap((r) => r.warnings)).toEqual([]);
	});

	it('keeps the eight-decimal rate in millionths of a cent', () => {
		// $0.48829897 per security. Cents alone would round it to 49.
		expect(distributionFromRows(statementRows()).rows[0].centsPerUnit).toBe(48_829_897);
	});

	it('reads the statement totals', () => {
		expect(distributionFromRows(statementRows()).totals).toEqual({
			grossPayment: 619_863,
			taxWithheld: 0,
			netPayment: 619_863
		});
	});

	it('warns when units times the rate misses the stated gross', () => {
		const rows = defaultHoldings();
		rows[0][3] = '2,000'; // fewer units than the payment implies
		const s = distributionFromRows(statementRows(rows));
		expect(s.rows[0].warnings.join(' ')).toMatch(/units at the stated rate/);
	});

	it('warns when gross less tax does not equal the stated net', () => {
		const rows = defaultHoldings();
		rows[0][5] = '10.00';
		const s = distributionFromRows(statementRows(rows));
		expect(s.rows[0].warnings.join(' ')).toMatch(/does not equal the stated net/);
	});

	it('warns when the rows do not add up to the statement total', () => {
		const s = distributionFromRows(statementRows([defaultHoldings()[0]]));
		expect(s.warnings.join(' ')).toMatch(/A row may have been missed/);
	});

	it('reports a statement it cannot read rows from', () => {
		const s = distributionFromRows([['Important Notice for Securityholders']]);
		expect(s.rows).toEqual([]);
		expect(s.warnings.join(' ')).toMatch(/no distribution rows/);
	});

	it('carries tax withheld through as cents', () => {
		const rows = defaultHoldings();
		rows[0][5] = '325.10';
		rows[0][6] = '1,064.11';
		const s = distributionFromRows(statementRows(rows));
		expect(s.rows[0].taxWithheld).toBe(32_510);
		expect(s.rows[0].warnings).toEqual([]);
	});
});
