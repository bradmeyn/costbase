import { describe, it, expect } from 'vitest';
import { amitFromRows, looksLikeAmitStatement } from './parse-amit-statement';

/*
  Rows mirror a Computershare AMMA statement. The real PDFs are not committed: they
  carry a name, address and HIN.
*/
const statement = (over: string[][] = []): string[][] => [
	['Vanguard Investments Australia Limited'],
	['T', '471956', '000', 'VAS', '(international) +61 3 9415 4813'],
	['MR SOMEONE'],
	['ATTRIBUTION MANAGED INVESTMENT TRUST MEMBER ANNUAL TAX STATEMENT FOR YEAR ENDED 30 JUNE 2026'],
	['PART A – SUMMARY OF 2026 TAX RETURN (SUPPLEMENTARY SECTION) ITEMS'],
	['Item', 'Tax Return Label', 'Amount'],
	['Share of net income from trusts, less net capital gains', '13U', '$2,134.42'],
	['Franked distributions from trusts', '13C', '$11,458.32'],
	['Share of franking credits from franked dividends', '13Q', '$3,538.89'],
	['Share of credit for TFN amounts withheld', '13R', '$0.00'],
	['Share of credit for foreign resident withholding amounts', '13A', '$0.00'],
	['Net capital gain', '18A', '$0.00'],
	['Total current year capital gains', '18H', '$0.00'],
	['Assessable foreign source income', '20E', '$282.99'],
	['Other net foreign source income', '20M', '$282.99'],
	['Foreign income tax offset', '20O', '$37.26'],
	['PART B – COMPONENTS OF ATTRIBUTION'],
	['Unfranked distributions', '$183.92'],
	['Non primary production income', '$2,134.42'],
	...over
];

describe('looksLikeAmitStatement', () => {
	it('recognises the annual statement', () => {
		expect(looksLikeAmitStatement(statement())).toBe(true);
	});

	it('does not claim a contract note', () => {
		expect(looksLikeAmitStatement([['Buy Confirmation'], ['TICKER', 'VAS.ASX']])).toBe(false);
	});
});

describe('amitFromRows', () => {
	it('reads the year the statement covers', () => {
		expect(amitFromRows(statement()).financialYear).toBe(2026);
	});

	it('reads which holding it is for', () => {
		expect(amitFromRows(statement()).ticker).toBe('VAS');
	});

	it('reads every Part A label', () => {
		const { amounts, warnings } = amitFromRows(statement());
		expect(amounts.label13U).toBe(2134.42);
		expect(amounts.label13C).toBe(11458.32);
		expect(amounts.label20O).toBe(37.26);
		expect(warnings).toEqual([]);
	});

	it('reads a single-figure Part B line', () => {
		expect(amitFromRows(statement()).amounts.unfrankedDistributions).toBe(183.92);
	});

	it('puts the franked figures in the right columns', () => {
		// The cash column is blank, so the line carries credit then attribution.
		const s = amitFromRows(statement([['Franked Distributions', '$3,538.89', '$11,458.32']]));
		expect(s.amounts.frankedDistributionsCredit).toBe(3538.89);
		expect(s.amounts.frankedDistributionsAttribution).toBe(11458.32);
		expect(s.warnings).toEqual([]);
	});

	it('reads foreign income as offset then attribution', () => {
		const s = amitFromRows(statement([['Assessable foreign source income', '$37.26', '$282.99']]));
		expect(s.amounts.foreignIncomeTaxOffset).toBe(37.26);
		expect(s.amounts.assessableForeignSourceIncome).toBe(282.99);
	});

	it('reads the gross line as cash then attribution', () => {
		const s = amitFromRows(statement([['Gross Amount', '$10,309.63', '$13,875.73']]));
		expect(s.amounts.grossCashDistribution).toBe(10309.63);
		expect(s.amounts.grossAttribution).toBe(13875.73);
	});

	it('reads the cost base adjustment', () => {
		const s = amitFromRows(
			statement([['AMIT cost base net amount - excess (reduce cost base)', '$10.05']])
		);
		expect(s.amounts.amitCostBaseExcess).toBe(10.05);
	});

	it('matches a line whatever dash it is printed with', () => {
		const s = amitFromRows(statement([['Capital gains – other method NTAP', '$12.00']]));
		expect(s.amounts.otherMethodNtap).toBe(12);
	});

	it('says so when Part A cannot be read', () => {
		const rows = statement().filter((r) => r[1] !== '13U');
		expect(amitFromRows(rows).warnings.join(' ')).toMatch(/Could not read Part A 13U/);
	});

	it('reports a statement with no year', () => {
		const rows = statement().filter((r) => !/YEAR ENDED/.test(r.join(' ')));
		const s = amitFromRows(rows);
		expect(s.financialYear).toBeNull();
		expect(s.warnings.join(' ')).toMatch(/which financial year/);
	});
});
