import { describe, it, expect } from 'vitest';
import {
	currentFinancialYear,
	describeWindow,
	financialYearWindow,
	isoDay,
	matchedFinancialYear,
	readWindow,
	windowTag,
	financialYearLabel,
	readFinancialYear
} from './report-period';

const url = (search: string) => new URL(`https://example.test/r${search}`);

describe('isoDay', () => {
	it('reads the local date, not the UTC one', () => {
		// 1 July at local midnight is still 30 June in UTC east of Greenwich.
		expect(isoDay(new Date(2025, 6, 1))).toBe('2025-07-01');
	});
});

describe('currentFinancialYear', () => {
	it('turns over on 1 July', () => {
		expect(currentFinancialYear(new Date(2026, 5, 30))).toBe(2026);
		expect(currentFinancialYear(new Date(2026, 6, 1))).toBe(2027);
	});
});

describe('financialYearLabel', () => {
	it('spans both calendar years, so the current one is not mistaken for the next', () => {
		expect(financialYearLabel(2027)).toBe('FY2026-27');
		expect(financialYearLabel(2026)).toBe('FY2025-26');
	});

	it('pads a year that ends in a single digit', () => {
		expect(financialYearLabel(2030)).toBe('FY2029-30');
		expect(financialYearLabel(2009)).toBe('FY2008-09');
	});
});

describe('financialYearWindow', () => {
	it('runs 1 July to 30 June of the year it is named for', () => {
		expect(financialYearWindow(2026)).toEqual({ from: '2025-07-01', to: '2026-06-30' });
	});
});

describe('readWindow', () => {
	it('is empty when nothing is set', () => {
		expect(readWindow(url(''))).toEqual({ from: undefined, to: undefined });
	});

	it('reads both bounds', () => {
		expect(readWindow(url('?from=2025-07-01&to=2026-06-30'))).toEqual({
			from: '2025-07-01',
			to: '2026-06-30'
		});
	});

	it('accepts one bound on its own', () => {
		expect(readWindow(url('?from=2024-01-01')).to).toBeUndefined();
	});

	it('ignores anything that is not a date', () => {
		expect(readWindow(url('?from=last-tuesday&to='))).toEqual({
			from: undefined,
			to: undefined
		});
	});
});

describe('matchedFinancialYear', () => {
	it('recognises a window that is exactly a financial year', () => {
		expect(matchedFinancialYear(financialYearWindow(2025), [2026, 2025])).toBe(2025);
	});

	it('returns null for a span that is not one', () => {
		expect(matchedFinancialYear({ from: '2025-07-01', to: '2025-12-31' }, [2026, 2025])).toBeNull();
	});

	it('returns null for a half-open window', () => {
		expect(matchedFinancialYear({ from: '2025-07-01' }, [2026, 2025])).toBeNull();
	});
});

describe('describeWindow', () => {
	it('names an unbounded window', () => {
		expect(describeWindow({})).toBe('All time');
	});

	// Month names come from the runtime's locale data, so match the shape, not the
	// spelling: Node and the browser disagree on whether en-AU shortens "July".
	it('reads a one-sided window as open-ended', () => {
		expect(describeWindow({ from: '2025-07-01' })).toMatch(/^From 1 Jul\w* 2025$/);
		expect(describeWindow({ to: '2026-06-30' })).toMatch(/^Up to 30 Jun\w* 2026$/);
	});

	it('reads a full window as a span', () => {
		expect(describeWindow(financialYearWindow(2026))).toMatch(/^1 Jul\w* 2025 to 30 Jun\w* 2026$/);
	});
});

describe('windowTag', () => {
	it('names a financial year across both calendar years', () => {
		expect(windowTag(financialYearWindow(2026), [2026])).toBe('FY2025-26');
	});

	it('names an unbounded window', () => {
		expect(windowTag({}, [2026])).toBe('all-time');
	});

	it('spells out any other span', () => {
		expect(windowTag({ from: '2025-07-01', to: '2025-12-31' }, [2026])).toBe(
			'2025-07-01-to-2025-12-31'
		);
	});
});

describe('readFinancialYear', () => {
	const url = (search: string) => new URL(`https://example.test/r${search}`);

	it('takes the year from the URL', () => {
		expect(readFinancialYear(url('?fy=2024'), [2026, 2025])).toBe(2024);
	});

	it('falls back to the newest year with activity, not the one we are in', () => {
		// At tax time the year that just ended is the one you are filing for.
		expect(readFinancialYear(url(''), [2026, 2025])).toBe(2026);
	});

	it('falls back to the current year when nothing has happened yet', () => {
		expect(readFinancialYear(url(''), [])).toBe(currentFinancialYear());
	});

	it('ignores a year that is not one', () => {
		expect(readFinancialYear(url('?fy=soon'), [2026])).toBe(2026);
	});
});
