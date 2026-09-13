import { getDocumentProxy } from 'unpdf';
import { extractRows } from './pdf-rows.js';

/*
  Parses a Computershare distribution statement for Vanguard's Australian ETFs.

  One statement covers every holding paid on the same date, so it yields several
  rows rather than one record. Nothing is trusted: each row carries its own
  warnings and the caller confirms the figures before anything is written.
*/

export interface ParsedDistributionRow {
	ticker: string;
	fundName: string;
	/** Cash per security in millionths of a cent — the rate carries eight decimals. */
	centsPerUnit: number | null;
	/** Units held at the record date, as stated. */
	units: number | null;
	grossPayment: number | null;
	taxWithheld: number;
	netPayment: number | null;
	warnings: string[];
}

export interface ParsedDistributionStatement {
	/** ISO dates. */
	recordDate: string | null;
	paymentDate: string | null;
	/** The period the distribution covers, e.g. "30 June 2026". */
	periodEnd: string | null;
	rows: ParsedDistributionRow[];
	totals: { grossPayment: number | null; taxWithheld: number | null; netPayment: number | null };
	warnings: string[];
}

export async function parseDistributionStatement(
	bytes: Uint8Array
): Promise<ParsedDistributionStatement> {
	return distributionFromRows(await extractRows(await getDocumentProxy(bytes)));
}

/** "$1,389.21" -> 138921 cents. */
function toCents(raw: string | undefined): number | null {
	if (!raw) return null;
	const m = raw.replace(/[,\s$A]/g, '').match(/^-?\d+(\.\d+)?$/);
	return m ? Math.round(parseFloat(m[0]) * 100) : null;
}

/** "0.48829897" dollars per security -> 48829897 millionths of a cent. */
function toRate(raw: string | undefined): number | null {
	if (!raw) return null;
	const m = raw.replace(/[,\s$]/g, '').match(/^\d+(\.\d+)?$/);
	return m ? Math.round(parseFloat(m[0]) * 1e8) : null;
}

function toUnits(raw: string | undefined): number | null {
	if (!raw) return null;
	const cleaned = raw.replace(/[,\s]/g, '');
	if (!/^\d+$/.test(cleaned)) return null;
	return parseInt(cleaned, 10);
}

const MONTHS = [
	'january',
	'february',
	'march',
	'april',
	'may',
	'june',
	'july',
	'august',
	'september',
	'october',
	'november',
	'december'
];

/** "2 July 2026" -> "2026-07-02". */
function toIsoDate(raw: string | null | undefined): string | null {
	if (!raw) return null;
	const m = raw.match(/(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})/);
	if (!m) return null;
	const month = MONTHS.indexOf(m[2].toLowerCase());
	if (month === -1) return null;
	return `${m[3]}-${String(month + 1).padStart(2, '0')}-${m[1].padStart(2, '0')}`;
}

/** The cell following a label within the same row. */
function valueAfter(rows: string[][], label: string): string | null {
	for (const row of rows) {
		const i = row.findIndex((c) => c.toUpperCase() === label);
		if (i !== -1 && i + 1 < row.length) return row[i + 1];
	}
	return null;
}

/** Exported separately so the field mapping can be tested without a PDF fixture. */
export function distributionFromRows(rows: string[][]): ParsedDistributionStatement {
	const warnings: string[] = [];

	const recordDate = toIsoDate(valueAfter(rows, 'RECORD DATE:'));
	const paymentDate = toIsoDate(valueAfter(rows, 'PAYMENT DATE:'));
	if (!recordDate) warnings.push('Could not read the record date.');
	if (!paymentDate) warnings.push('Could not read the payment date.');

	const periodEnd =
		rows
			.flat()
			.find((c) => /period ended/i.test(c))
			?.match(/period ended\s+(.+)$/i)?.[1]
			?.trim() ?? null;

	/*
	  A holding row is the only place a ticker, a rate, a unit count and three money
	  columns sit together, so match the shape rather than a column position — the
	  fund name is a single cell but its length varies.
	*/
	const parsedRows: ParsedDistributionRow[] = [];
	for (const row of rows) {
		if (row.length < 7) continue;
		if (!/^[A-Z]{3}$/.test(row[0])) continue;

		const centsPerUnit = toRate(row[2]);
		const units = toUnits(row[3]);
		const grossPayment = toCents(row[4]);
		const taxWithheld = toCents(row[5]);
		const netPayment = toCents(row[6]);
		if (centsPerUnit === null || units === null || grossPayment === null) continue;

		const rowWarnings: string[] = [];

		// units x rate should reproduce the gross, give or take the statement's rounding.
		const expectedGross = Math.round((units * centsPerUnit) / 1e6);
		if (Math.abs(expectedGross - grossPayment) > 2) {
			rowWarnings.push(
				`${row[0]}: ${units} units at the stated rate comes to $${(expectedGross / 100).toFixed(2)}, but the statement says $${(grossPayment / 100).toFixed(2)}.`
			);
		}

		if (netPayment !== null && grossPayment - (taxWithheld ?? 0) !== netPayment) {
			rowWarnings.push(`${row[0]}: gross less tax withheld does not equal the stated net amount.`);
		}

		parsedRows.push({
			ticker: row[0],
			fundName: row[1],
			centsPerUnit,
			units,
			grossPayment,
			taxWithheld: taxWithheld ?? 0,
			netPayment,
			warnings: rowWarnings
		});
	}

	if (parsedRows.length === 0) warnings.push('Found no distribution rows in this statement.');

	const totalRow = rows.find((r) => r[0]?.toUpperCase() === 'TOTAL:');
	const totals = {
		grossPayment: toCents(totalRow?.[1]),
		taxWithheld: toCents(totalRow?.[2]),
		netPayment: toCents(totalRow?.[3])
	};

	if (totals.grossPayment !== null && parsedRows.length > 0) {
		const summed = parsedRows.reduce((sum, r) => sum + (r.grossPayment ?? 0), 0);
		if (summed !== totals.grossPayment) {
			warnings.push(
				`The rows read here total $${(summed / 100).toFixed(2)}, but the statement's total is $${(totals.grossPayment / 100).toFixed(2)}. A row may have been missed.`
			);
		}
	}

	return { recordDate, paymentDate, periodEnd, rows: parsedRows, totals, warnings };
}
