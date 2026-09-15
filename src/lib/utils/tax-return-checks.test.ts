import { describe, it, expect } from 'vitest';
import { checkTaxReturn, type HoldingCompleteness } from './tax-return-checks';

const holding = (over: Partial<HoldingCompleteness> = {}): HoldingCompleteness => ({
	code: 'VAS',
	hasStatement: true,
	distributionsTotal: 1_389_21,
	distributionCount: 1,
	statementGrossCash: 1_389_21,
	annualStatementCount: 1,
	statementClosingUnits: 2_845,
	unitsAtYearEnd: 2_845,
	statementCashPaid: 1_389_00,
	cashPaidTotal: 1_389_21,
	...over
});

const input = (over: Partial<Parameters<typeof checkTaxReturn>[0]> = {}) => ({
	financialYearLabel: 'FY2025-26',
	holdings: [holding()],
	priorYearLossRecorded: true,
	capitalGainsMismatch: null,
	...over
});

const messages = (r: ReturnType<typeof checkTaxReturn>) => r.map((p) => p.message).join(' | ');

describe('checkTaxReturn', () => {
	it('says nothing when everything reconciles', () => {
		expect(checkTaxReturn(input())).toEqual([]);
	});

	it('calls a paid holding with no statement a problem', () => {
		const r = checkTaxReturn(input({ holdings: [holding({ hasStatement: false })] }));
		expect(r[0].severity).toBe('problem');
		expect(r[0].message).toMatch(/was paid \$1,389.21 in FY2025-26 but has no tax statement/);
	});

	it('only notes a holding with neither statement nor distributions', () => {
		const r = checkTaxReturn(
			input({
				holdings: [holding({ hasStatement: false, distributionCount: 0, distributionsTotal: 0 })]
			})
		);
		expect(r[0].severity).toBe('note');
	});

	it('notes a statement with no distributions to check it against', () => {
		const r = checkTaxReturn(
			input({ holdings: [holding({ distributionCount: 0, distributionsTotal: 0 })] })
		);
		expect(r[0].severity).toBe('note');
		expect(messages(r)).toMatch(/cash side cannot be checked/);
	});

	it('reports cash that was paid but never recorded', () => {
		const r = checkTaxReturn(input({ holdings: [holding({ distributionsTotal: 1_000_00 })] }));
		expect(r[0].severity).toBe('problem');
		expect(r[0].message).toMatch(/\$389.21 missing/);
	});

	it('reports more cash recorded than the statement says', () => {
		const r = checkTaxReturn(input({ holdings: [holding({ distributionsTotal: 2_000_00 })] }));
		expect(r[0].message).toMatch(/\$610.79 too much/);
	});

	it('passes a fund whose parts do not add up through', () => {
		const r = checkTaxReturn(input({ capitalGainsMismatch: 20_00 }));
		expect(messages(r)).toMatch(/do not add up to the total it reported/);
	});

	it('notes losses carried forward that were never entered', () => {
		const r = checkTaxReturn(input({ priorYearLossRecorded: false }));
		expect(r[0].severity).toBe('note');
		expect(r[0].message).toMatch(/18A is overstated until they are entered/);
		// Shown beside the input that records them, not in a banner at the top.
		expect(r[0].topic).toBe('carried-forward-losses');
	});

	it('finds a unit count that disagrees with the registry', () => {
		const r = checkTaxReturn(input({ holdings: [holding({ unitsAtYearEnd: 2_839 })] }));
		expect(r[0].severity).toBe('problem');
		expect(r[0].message).toMatch(/the registry held 2,845 units .* works out to 2,839 — 6 missing/);
	});

	it('lets a whole-dollar rounding difference pass, per statement', () => {
		expect(checkTaxReturn(input({ holdings: [holding({ cashPaidTotal: 1_388_43 })] }))).toEqual([]);
		const r = checkTaxReturn(input({ holdings: [holding({ cashPaidTotal: 1_386_00 })] }));
		expect(r[0].severity).toBe('problem');
		expect(r[0].message).toMatch(
			/paid \$1,389.00 in cash during FY2025-26, but \$1,386.00 is recorded/
		);
	});

	it('allows twice the rounding when a broker change split the year', () => {
		expect(
			checkTaxReturn(
				input({
					holdings: [holding({ annualStatementCount: 2, cashPaidTotal: 1_387_50 })]
				})
			)
		).toEqual([]);
	});

	it('notes a year with no annual statement at all', () => {
		const r = checkTaxReturn(input({ holdings: [holding({ annualStatementCount: 0 })] }));
		expect(r[0].severity).toBe('note');
		expect(r[0].message).toMatch(/has no annual statement for FY2025-26/);
	});
});
