import { getDocumentProxy } from 'unpdf';
import { extractRows } from './pdf-rows.js';
import {
	AMIT_AUSTRALIAN_INCOME,
	AMIT_CAPITAL_GAINS,
	AMIT_PART_A,
	AMIT_RECONCILIATION
} from '#lib/schemas/amit.js';

/*
  Parses a Computershare AMMA statement — the AMIT Member Annual Statement each fund
  issues after 30 June.

  Part A is a label and an amount per line, so it reads straight off. Part B is a
  three-column table where empty columns collapse out of the row, which means a line
  with two figures could be columns 1 and 3 or columns 2 and 3. Position alone cannot
  tell them apart; the meaning of the line can, so those few are mapped by name.
*/

export interface ParsedAmitStatement {
	/** The year the financial year ends in: 2026 = 1 Jul 2025 - 30 Jun 2026. */
	financialYear: number | null;
	ticker: string | null;
	/**
	 * The holder number the statement was issued against, masked as printed. Two
	 * statements for one year differ only by this, so it is what tells them apart.
	 */
	holderNumber: string;
	/** Field name from the statement schema to a dollar amount, as typed. */
	amounts: Record<string, number>;
	warnings: string[];
}

/** Comparable form of a statement line: case, punctuation and dashes all vary. */
function normalise(text: string): string {
	return text
		.toLowerCase()
		.replace(/[‐-―]/g, '-')
		.replace(/[^a-z0-9]+/g, ' ')
		.trim();
}

/** "$11,458.32" -> 11458.32. Dollars, matching how the statement form is filled in. */
function toDollars(raw: string | undefined): number | null {
	if (!raw) return null;
	const cleaned = raw.replace(/[$,\s]/g, '');
	if (!/^-?\d+(\.\d+)?$/.test(cleaned)) return null;
	return parseFloat(cleaned);
}

/*
  Lines whose leading figure is not the cash column. Each is a row the statement
  leaves blank on the left, so its two figures are the middle and right columns.
*/
const LEADING_FIELD: Record<string, string> = {
	'franked distributions': 'frankedDistributionsCredit',
	'assessable foreign source income': 'foreignIncomeTaxOffset'
};

/** Part B lines that carry an attribution figure, by normalised description. */
const ATTRIBUTION_FIELD = new Map<string, string>([
	...AMIT_AUSTRALIAN_INCOME.map(([field, label]) => [normalise(label), field] as [string, string]),
	...AMIT_CAPITAL_GAINS.map(([field, label]) => [normalise(label), field] as [string, string]),
	...AMIT_RECONCILIATION.map(([field, label]) => [normalise(label), field] as [string, string]),
	['franked distributions', 'frankedDistributionsAttribution'],
	['assessable foreign source income', 'assessableForeignSourceIncome'],
	['gross amount', 'grossAttribution']
]);

/** Whether these rows are a fund's AMIT Member Annual Statement. */
export function looksLikeAmitStatement(rows: string[][]): boolean {
	const squashed = rows.flat().join('').toUpperCase().replace(/\s+/g, '');
	return (
		squashed.includes('MEMBERANNUALTAXSTATEMENT') ||
		squashed.includes('ATTRIBUTIONMANAGEDINVESTMENTTRUSTMEMBER')
	);
}

export async function parseAmitStatement(bytes: Uint8Array): Promise<ParsedAmitStatement> {
	return amitFromRows(await extractRows(await getDocumentProxy(bytes)));
}

/** Exported separately so the field mapping can be tested without a PDF fixture. */
export function amitFromRows(rows: string[][]): ParsedAmitStatement {
	const warnings: string[] = [];
	const amounts: Record<string, number> = {};

	const flat = rows.flat().join(' ');

	const year = flat.match(/YEAR ENDED\s+\d{1,2}\s+\w+\s+(\d{4})/i);
	const financialYear = year ? parseInt(year[1], 10) : null;
	if (!financialYear) warnings.push('Could not read which financial year this statement covers.');

	/*
	  The ticker sits alone in the address block. Every other short run of capitals on
	  the page is part of a longer sentence, so a standalone cell is unambiguous.
	*/
	const ticker =
		rows
			.slice(0, 20)
			.flat()
			.find((cell) => /^[A-Z]{3,4}$/.test(cell)) ?? null;
	if (!ticker) warnings.push('Could not read which holding this statement is for.');

	/*
	  The holder number sits beside the address, printed masked on some years
	  ("X ******0953") and in full on others ("X 0087526992"). Reduced to its last four
	  digits: that is all that differs between two statements for the same year, and it
	  is the same four whichever way the registry chose to print it.
	*/
	const holderNumber =
		rows
			.slice(0, 25)
			.flat()
			.map((cell) => cell.replace(/\s+/g, ''))
			.find((cell) => /^[A-Z][*\d]{6,}$/.test(cell))
			?.slice(-4) ?? '';

	// Part A: description, label, amount.
	const byLabel = new Map<string, string>(AMIT_PART_A.map(([field, label]) => [label, field]));
	for (const row of rows) {
		const label = row.find((cell) => byLabel.has(cell.trim().toUpperCase()));
		if (!label) continue;
		const amount = toDollars(row[row.length - 1]);
		if (amount === null) continue;
		amounts[byLabel.get(label.trim().toUpperCase())!] = amount;
	}

	const missingPartA = AMIT_PART_A.filter(([field]) => !(field in amounts)).map(
		([, label]) => label
	);
	if (missingPartA.length > 0) {
		warnings.push(`Could not read Part A ${missingPartA.join(', ')}.`);
	}

	// Part B: description then one figure per column the statement filled in.
	for (const row of rows) {
		if (row.length < 2) continue;
		const key = normalise(row[0]);
		const field = ATTRIBUTION_FIELD.get(key);
		if (!field) continue;

		const figures = row.slice(1).map(toDollars);
		if (figures.some((f) => f === null)) continue;
		const values = figures as number[];

		// The right-most figure is always the attribution column.
		amounts[field] = values[values.length - 1];

		if (values.length > 1) {
			const leading =
				LEADING_FIELD[key] ?? (key === 'gross amount' ? 'grossCashDistribution' : null);
			if (leading) {
				amounts[leading] = values[0];
			} else {
				warnings.push(
					`"${row[0]}" has ${values.length} figures and it is not clear which columns they belong to. Check that line against the statement.`
				);
			}
		}
	}

	return { financialYear, ticker, holderNumber, amounts, warnings };
}
