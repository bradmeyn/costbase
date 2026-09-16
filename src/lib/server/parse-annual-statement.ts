import { getDocumentProxy } from 'unpdf';
import { extractRows, isoFromLongDate } from './pdf-rows.js';

/*
  Parses a Computershare annual (MIS) statement for a Vanguard ETF.

  This is the registry's own record of a year: units in and out, the balance it held
  at 30 June, and the cash it paid. The statement says of itself that it "should not
  be used for tax purposes", and that is right — nothing here belongs on a return.
  Its value is as an independent check that the app's own transactions and
  distributions are complete.
*/

export interface ParsedAnnualStatement {
	/** The year the financial year ends in: 2025 = 1 Jul 2024 - 30 Jun 2025. */
	financialYear: number | null;
	/** ISO date the statement's period ends, which is 30 June unless the holding closed. */
	periodEnd: string | null;
	ticker: string | null;
	/** Last four digits of the holder number, matching the tax statement's. */
	holderNumber: string;
	/** Units held at the start and end of the period, as the registry counted them. */
	openingUnits: number | null;
	closingUnits: number | null;
	/** Cents. */
	closingUnitPrice: number | null;
	closingValue: number | null;
	/** Cash distributions the registry paid over the year, in cents. */
	cashDistributionReceived: number | null;
	/** Fees taken inside the fund. Not a cost base item — informational only. */
	totalFees: number | null;
	warnings: string[];
}

function toCents(raw: string | undefined): number | null {
	if (!raw) return null;
	const cleaned = raw.replace(/[$,\s]/g, '');
	if (!/^-?\d+(\.\d+)?$/.test(cleaned)) return null;
	return Math.round(parseFloat(cleaned) * 100);
}

function toUnits(raw: string | undefined): number | null {
	if (!raw) return null;
	const cleaned = raw.replace(/[,\s]/g, '');
	return /^-?\d+$/.test(cleaned) ? parseInt(cleaned, 10) : null;
}

/** Whether these rows are a registry annual statement rather than a tax one. */
export function looksLikeAnnualStatement(rows: string[][]): boolean {
	const squashed = rows.flat().join('').toUpperCase().replace(/\s+/g, '');
	return squashed.includes('ANNUALSTATEMENT') && !squashed.includes('MEMBERANNUALTAXSTATEMENT');
}

export async function parseAnnualStatement(bytes: Uint8Array): Promise<ParsedAnnualStatement> {
	return annualFromRows(await extractRows(await getDocumentProxy(bytes)));
}

/** Exported separately so the field mapping can be tested without a PDF fixture. */
export function annualFromRows(rows: string[][]): ParsedAnnualStatement {
	const warnings: string[] = [];
	const flat = rows.flat();
	const joined = flat.join(' ');

	const period = joined.match(/Statement for period:\s*(.+?)\s+to\s+(\d{1,2}\s+\w+\s+\d{4})/i);
	const periodEnd = period ? isoFromLongDate(period[2]) : null;

	/*
	  Taken from the financial year the period ends in, not its calendar year. A holding
	  closed mid-year gets a final statement ending on the transfer date — 30 December
	  2024 still belongs to the year ending June 2025.
	*/
	const financialYear = periodEnd
		? Number(periodEnd.slice(0, 4)) + (Number(periodEnd.slice(5, 7)) >= 7 ? 1 : 0)
		: null;
	if (!financialYear) warnings.push('Could not read the period this statement covers.');

	const ticker = joined.match(/ASX Code:\s*([A-Z]{2,5})/)?.[1] ?? null;
	if (!ticker) warnings.push('Could not read which holding this statement is for.');

	/*
	  Printed in full here, unlike the tax statement. Reduced to its last four digits so
	  the two documents for one year line up with each other.
	*/
	const holderNumber =
		flat
			.map((cell) => cell.replace(/\s+/g, ''))
			.find((cell) => /^[A-Z]\d{8,}$/.test(cell))
			?.slice(-4) ?? '';

	/*
	  The balance rows carry a different number of cells depending on which columns the
	  statement left blank, but units held is always the second from the right.
	*/
	const balanceRow = (label: string) =>
		rows.find((row) => row.some((cell) => cell.trim().toLowerCase() === label));

	const opening = balanceRow('opening balance');
	const closing = balanceRow('closing balance');

	const openingUnits = opening ? toUnits(opening[opening.length - 2]) : null;
	const closingUnits = closing ? toUnits(closing[closing.length - 2]) : null;
	const closingValue = closing ? toCents(closing[closing.length - 1]) : null;
	const closingUnitPrice = closing ? toCents(closing[closing.length - 3]) : null;

	if (closingUnits === null) warnings.push('Could not read the closing balance.');

	const labelled = (label: string) => {
		const row = rows.find((r) => r[0]?.trim().toLowerCase() === label);
		return row ? toCents(row[row.length - 1]) : null;
	};

	const cashDistributionReceived = labelled('cash distribution received');
	const totalFees = labelled('total fees and costs you paid');

	return {
		financialYear,
		periodEnd,
		ticker,
		holderNumber,
		openingUnits,
		closingUnits,
		closingUnitPrice,
		closingValue,
		cashDistributionReceived,
		totalFees,
		warnings
	};
}
