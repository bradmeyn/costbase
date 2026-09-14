import { describe, it, expect } from 'vitest';
import { checkTaxReturn, type HoldingCompleteness } from './tax-return-checks';

const holding = (over: Partial<HoldingCompleteness> = {}): HoldingCompleteness => ({
	code: 'VAS',
	hasStatement: true,
	distributionsTotal: 1_389_21,
	distributionCount: 1,
	statementGrossCash: 1_389_21,
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
	});
});
