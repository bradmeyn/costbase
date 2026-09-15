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
	/**
	 * Set when the distribution was reinvested rather than paid out. The units are
	 * allotted at the DRP price, which is a separate acquisition with its own cost base.
	 */
	reinvestment: { unitsAllotted: number; drpPrice: number; cashCarriedForward: number } | null;
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
	/** A reinvestment statement allots units; a payment statement pays cash. */
	kind: 'payment' | 'reinvestment';
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
function toCents(raw: string | null | undefined): number | null {
	if (!raw) return null;
	const m = raw.replace(/[,\s$A]/g, '').match(/^-?\d+(\.\d+)?$/);
	return m ? Math.round(parseFloat(m[0]) * 100) : null;
}

/** "0.48829897" dollars per security -> 48829897 millionths of a cent. */
function toRate(raw: string | null | undefined): number | null {
	if (!raw) return null;
	const m = raw.replace(/[,\s$]/g, '').match(/^\d+(\.\d+)?$/);
	return m ? Math.round(parseFloat(m[0]) * 1e8) : null;
}

function toUnits(raw: string | null | undefined): number | null {
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
	// Matched with or without a trailing colon: the registry punctuates its labels
	// differently on the combined statement and the single-holding advice.
	const wanted = label.replace(/:$/, '');
	for (const row of rows) {
		const i = row.findIndex((c) => c.trim().toUpperCase().replace(/:$/, '') === wanted);
		if (i !== -1 && i + 1 < row.length) return row[i + 1];
	}
	return null;
}

function isSingleHoldingAdvice(rows: string[][]): boolean {
	const squashed = rows.flat().join('').toUpperCase().replace(/\s+/g, '');
	return squashed.includes('DISTRIBUTIONREINVESTMENTPLANADVICE');
}

/**
 * One holding's reinvestment advice. The units allotted and the price they were
 * bought at are written into a sentence rather than a column, so they are read from
 * it: "Amount applied to 38 ETF securities allotted @ $95.2101 each".
 */
function adviceFromRows(
	rows: string[][],
	recordDate: string | null,
	paymentDate: string | null,
	periodEnd: string | null,
	warnings: string[]
): ParsedDistributionStatement {
	const ticker = valueAfter(rows, 'ASX CODE');
	if (!ticker) warnings.push('Could not read which holding this advice is for.');

	const classRow = rows.find(
		(row) => row.length >= 4 && /^[A-Z]{2,4}$/.test(row[0]) && /^\$?\d/.test(row[1])
	);

	const centsPerUnit = classRow ? toRate(classRow[1]) : null;
	const units = classRow ? toUnits(classRow[2]) : null;
	const grossPayment = classRow ? toCents(classRow[3]) : null;
	const taxWithheld = toCents(valueAfter(rows, 'WITHHOLDING TAX:')) ?? 0;
	const netPayment = toCents(valueAfter(rows, 'NET PAYMENT:'));

	if (!classRow) warnings.push('Could not read the distribution line on this advice.');

	const allotted = rows
		.flat()
		.join(' ')
		.match(/Amount applied to\s+([\d,]+)\s+\w+\s+securities allotted @\s*\$([\d.]+)/i);
	const cashCarriedForward =
		toCents(valueAfter(rows, 'CASH SURPLUS CARRIED FORWARD TO NEXT DISTRIBUTION:')) ?? 0;

	const rowWarnings: string[] = [];
	if (units !== null && centsPerUnit !== null && grossPayment !== null) {
		const expected = Math.round((units * centsPerUnit) / 1e6);
		if (Math.abs(expected - grossPayment) > 2) {
			rowWarnings.push(
				`${ticker}: ${units} units at the stated rate comes to $${(expected / 100).toFixed(2)}, but the advice says $${(grossPayment / 100).toFixed(2)}.`
			);
		}
	}

	return {
		kind: 'reinvestment',
		recordDate,
		paymentDate,
		periodEnd,
		rows:
			ticker && centsPerUnit !== null && units !== null && grossPayment !== null
				? [
						{
							ticker,
							fundName: '',
							reinvestment: {
								unitsAllotted: allotted ? parseInt(allotted[1].replace(/,/g, ''), 10) : 0,
								drpPrice: allotted ? Math.round(parseFloat(allotted[2]) * 100) : 0,
								cashCarriedForward
							},
							centsPerUnit,
							units,
							grossPayment,
							taxWithheld,
							netPayment,
							warnings: rowWarnings
						}
					]
				: [],
		totals: { grossPayment, taxWithheld, netPayment },
		warnings
	};
}

/** Whether these rows are a registry distribution or reinvestment statement. */
export function looksLikeDistributionStatement(rows: string[][]): boolean {
	const squashed = rows.flat().join('').toUpperCase().replace(/\s+/g, '');
	return (
		squashed.includes('DISTRIBUTIONPAYMENT') ||
		squashed.includes('DISTRIBUTIONREINVESTMENTPLAN') ||
		squashed.includes('DISTRIBUTIONREINVESTMENTPLANADVICE')
	);
}

/** Exported separately so the field mapping can be tested without a PDF fixture. */
export function distributionFromRows(rows: string[][]): ParsedDistributionStatement {
	const warnings: string[] = [];

	const recordDate = toIsoDate(valueAfter(rows, 'RECORD DATE:'));
	const paymentDate = toIsoDate(valueAfter(rows, 'PAYMENT DATE:'));
	if (!recordDate) warnings.push('Could not read the record date.');
	if (!paymentDate) warnings.push('Could not read the payment date.');

	const isReinvestment = rows.flat().some((cell) => /distribution reinvestment plan/i.test(cell));

	const periodEnd =
		rows
			.flat()
			.find((c) => /period ended/i.test(c))
			?.match(/period ended\s+(.+)$/i)?.[1]
			?.trim() ?? null;

	/*
	  A single-holding reinvestment advice names its fund in an "ASX Code" field and
	  puts the one holding on a row labelled by class rather than by ticker, so it
	  cannot be read by either of the multi-holding layouts.
	*/
	if (isSingleHoldingAdvice(rows)) {
		return adviceFromRows(rows, recordDate, paymentDate, periodEnd, warnings);
	}

	if (isReinvestment) {
		return reinvestmentFromRows(rows, recordDate, paymentDate, periodEnd, warnings);
	}

	/*
	  A holding row is the only place a ticker, a rate, a unit count and three money
	  columns sit together, so match the shape rather than a column position — the
	  fund name is a single cell but its length varies.
	*/
	const parsedRows: ParsedDistributionRow[] = [];
	for (const row of rows) {
		if (row.length < 6) continue;
		if (!/^[A-Z]{3,4}$/.test(row[0])) continue;

		/*
		  Read from the right. A long fund name wraps onto its own line and drops out of
		  the row entirely — "Vanguard MSCI International Small Companies Index ETF" leaves
		  VISM with one cell fewer than its neighbours — so a fixed column would lose it.
		*/
		const tail = row.slice(-5);
		const centsPerUnit = toRate(tail[0]);
		const units = toUnits(tail[1]);
		const grossPayment = toCents(tail[2]);
		const taxWithheld = toCents(tail[3]);
		const netPayment = toCents(tail[4]);
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
			fundName: row.length > 6 ? row[1] : '',
			reinvestment: null,
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

	return {
		kind: 'payment',
		recordDate,
		paymentDate,
		periodEnd,
		rows: parsedRows,
		totals,
		warnings
	};
}

/*
  A reinvestment statement is a different document: no cash is paid, so instead of a
  net amount it reports the price the units were bought at, how many were allotted,
  and the odd cents carried forward to next time.

  Columns, once the wrapped headings are ignored:
    ASX | (fund name) | DRP price | units held | cash per security |
    tax withheld | net cash reinvested | balance brought forward |
    units allotted | cash carried forward
*/
function reinvestmentFromRows(
	rows: string[][],
	recordDate: string | null,
	paymentDate: string | null,
	periodEnd: string | null,
	warnings: string[]
): ParsedDistributionStatement {
	const parsedRows: ParsedDistributionRow[] = [];

	for (const row of rows) {
		if (row.length < 9) continue;
		if (!/^[A-Z]{3,4}$/.test(row[0])) continue;

		const tail = row.slice(-8);
		const drpPrice = toCents(tail[0]);
		const units = toUnits(tail[1]);
		const centsPerUnit = toRate(tail[2]);
		const taxWithheld = toCents(tail[3]);
		const netReinvested = toCents(tail[4]);
		const unitsAllotted = toUnits(tail[6]);
		const cashCarriedForward = toCents(tail[7]);

		if (drpPrice === null || units === null || centsPerUnit === null || netReinvested === null) {
			continue;
		}

		const rowWarnings: string[] = [];
		const expectedGross = Math.round((units * centsPerUnit) / 1e6);
		if (Math.abs(expectedGross - netReinvested) > 2) {
			rowWarnings.push(
				`${row[0]}: ${units} units at the stated rate comes to $${(expectedGross / 100).toFixed(2)}, but the statement reinvested $${(netReinvested / 100).toFixed(2)}.`
			);
		}

		parsedRows.push({
			ticker: row[0],
			fundName: row.length > 9 ? row[1] : '',
			reinvestment: {
				unitsAllotted: unitsAllotted ?? 0,
				drpPrice,
				cashCarriedForward: cashCarriedForward ?? 0
			},
			centsPerUnit,
			units,
			grossPayment: netReinvested + (taxWithheld ?? 0),
			taxWithheld: taxWithheld ?? 0,
			netPayment: netReinvested,
			warnings: rowWarnings
		});
	}

	if (parsedRows.length === 0) warnings.push('Found no reinvestment rows in this statement.');

	return {
		kind: 'reinvestment',
		recordDate,
		paymentDate,
		periodEnd,
		rows: parsedRows,
		totals: {
			grossPayment: parsedRows.reduce((sum, r) => sum + (r.grossPayment ?? 0), 0),
			taxWithheld: parsedRows.reduce((sum, r) => sum + r.taxWithheld, 0),
			netPayment: parsedRows.reduce((sum, r) => sum + (r.netPayment ?? 0), 0)
		},
		warnings
	};
}
