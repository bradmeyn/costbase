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

	it('is a payment statement unless it says otherwise', () => {
		expect(distributionFromRows(statementRows()).kind).toBe('payment');
	});

	it('reads a row whose fund name wrapped onto its own line', () => {
		// A long name leaves the row one cell shorter than its neighbours.
		const rows = statementRows([['VISM', '0.48766942', '2,591', '1,263.55', '0.00', '1,263.55']]);
		const parsed = distributionFromRows(rows);
		expect(parsed.rows).toHaveLength(1);
		expect(parsed.rows[0]).toMatchObject({ ticker: 'VISM', units: 2591, grossPayment: 126_355 });
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

/*
  A reinvestment statement pays no cash. Columns after the wrapped headings:
  ASX | DRP price | units held | cash per security | tax withheld | net reinvested |
  balance brought forward | units allotted | cash carried forward.
*/
const drpRows = (holdings: string[][]): string[][] => [
	['Record Date:', '2 July 2025'],
	['Payment Date:', '16 July 2025'],
	['Vanguard Distribution for the Period Ended 30 June 2025'],
	['Distribution Reinvestment Plan'],
	['ASX', 'Fund Name', 'DRP Price ($)', 'Units', 'Security ($)', 'Amount ($)'],
	...holdings
];

describe('distributionFromRows for a reinvestment', () => {
	const row = [
		'VAS',
		'105.6498',
		'3,573',
		'0.65015010',
		'0.00',
		'2,322.99',
		'0.00',
		'21',
		'104.34'
	];

	it('knows it is a reinvestment', () => {
		expect(distributionFromRows(drpRows([row])).kind).toBe('reinvestment');
	});

	it('reads the units allotted and the price they were bought at', () => {
		const parsed = distributionFromRows(drpRows([row]));
		expect(parsed.rows[0].reinvestment).toEqual({
			unitsAllotted: 21,
			drpPrice: 105_65,
			cashCarriedForward: 104_34
		});
	});

	it('treats the reinvested cash as the distribution', () => {
		const parsed = distributionFromRows(drpRows([row]));
		expect(parsed.rows[0]).toMatchObject({
			ticker: 'VAS',
			units: 3573,
			centsPerUnit: 65_015_010,
			grossPayment: 232_299,
			taxWithheld: 0,
			netPayment: 232_299
		});
		expect(parsed.rows[0].warnings).toEqual([]);
	});

	it('warns when the units and rate do not produce the reinvested amount', () => {
		const wrong = [...row];
		wrong[5] = '9,999.99';
		const parsed = distributionFromRows(drpRows([wrong]));
		expect(parsed.rows[0].warnings.join(' ')).toMatch(/but the statement reinvested/);
	});

	it('reports a reinvestment statement it cannot read rows from', () => {
		const parsed = distributionFromRows(drpRows([]));
		expect(parsed.warnings.join(' ')).toMatch(/no reinvestment rows/);
	});
});

/*
  A single-holding reinvestment advice: the fund is named in an ASX Code field, the
  one holding sits on a row labelled by class, and the units allotted are written
  into a sentence rather than a column.
*/
const adviceRows = (over: string[][] = []): string[][] => [
	['MR SOMEONE', 'X 0087526992'],
	['NEW LAMBTON NSW 2305', 'ASX Code', 'VAS'],
	['Record Date', '4 April 2022'],
	['Payment Date', '20 April 2022'],
	['Distribution Payment for the Period Ending 31 March 2022'],
	['Distribution Reinvestment Plan Advice'],
	['Class Description', 'Rate Per Security', 'Securities Held', 'Gross Amount'],
	['ETF', '$1.99587876', '1,810', '$3,612.54'],
	['Withholding tax:', '$0.00'],
	['NET PAYMENT:', '$3,612.54'],
	['Distribution Reinvestment Plan (DRP) Details'],
	['Amount applied to 38 ETF securities allotted @ $95.2101 each:', '$3,617.98'],
	['Cash surplus carried forward to next distribution:', '$53.40'],
	...over
];

describe('distributionFromRows for a single-holding advice', () => {
	it('knows it is a reinvestment', () => {
		expect(distributionFromRows(adviceRows()).kind).toBe('reinvestment');
	});

	it('reads the dates, which carry no colon here', () => {
		const s = distributionFromRows(adviceRows());
		expect(s.recordDate).toBe('2022-04-04');
		expect(s.paymentDate).toBe('2022-04-20');
	});

	it('takes the holding from the ASX code, not the class column', () => {
		const s = distributionFromRows(adviceRows());
		expect(s.rows[0].ticker).toBe('VAS');
	});

	it('reads the distribution and what it bought', () => {
		const s = distributionFromRows(adviceRows());
		expect(s.rows[0]).toMatchObject({
			units: 1810,
			centsPerUnit: 199_587_876,
			grossPayment: 361_254,
			taxWithheld: 0
		});
		expect(s.rows[0].reinvestment).toEqual({
			unitsAllotted: 38,
			drpPrice: 95_21,
			cashCarriedForward: 53_40
		});
		expect(s.warnings).toEqual([]);
		expect(s.rows[0].warnings).toEqual([]);
	});

	it('warns when the rate and units do not produce the gross', () => {
		const rows = adviceRows().map((r) =>
			r[0] === 'ETF' ? ['ETF', '$1.99587876', '1,810', '$9,999.99'] : r
		);
		expect(distributionFromRows(rows).rows[0].warnings.join(' ')).toMatch(/but the advice says/);
	});
});
