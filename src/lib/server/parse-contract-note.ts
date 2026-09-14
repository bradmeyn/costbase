import { getDocumentProxy } from 'unpdf';
import { extractRows } from './pdf-rows.js';

/*
  Parses a Stake ASX trade confirmation.

  Rows come back as the document lays them out (see extractRows), which restores the
  "LABEL  value" pairs from a stream that would otherwise interleave them.

  Nothing here is trusted: every field is returned alongside warnings, and the caller
  presents it for confirmation before anything is written.
*/

export interface ParsedContractNote {
	side: 'buy' | 'sell' | null;
	ticker: string | null;
	/** Whole units. */
	quantity: number | null;
	/** Cents. Four-decimal broker prices are rounded here; `value` is authoritative. */
	pricePerUnit: number | null;
	/** Total consideration in cents, as stated. */
	value: number | null;
	/** Brokerage and GST in cents. */
	brokerage: number | null;
	/** Stated net proceeds or net cost in cents, used to cross-check. */
	netAmount: number | null;
	executionDate: string | null;
	settlementDate: string | null;
	confirmationNumber: string | null;
	/** The broker that issued the note, where the name is one we recognise. */
	platform: string | null;
	/** Anything that did not parse, or arithmetic that did not reconcile. */
	warnings: string[];
}

/*
  Brokers whose name appears on their own confirmations. Matched on the flattened
  text rather than a fixed position: the branding sits in a different place on each
  one, and getting it wrong costs a label, not a figure.
*/
const BROKERS = [
	'Stake',
	'CommSec',
	'SelfWealth',
	'Pearler',
	'Superhero',
	'nabtrade',
	'CMC Markets',
	'Bell Direct',
	'Westpac Share Trading',
	'ANZ Share Investing'
];

/** The cell following a label within the same row. */
function valueAfter(rows: string[][], label: string): string | null {
	for (const row of rows) {
		const i = row.findIndex((c) => c.toUpperCase() === label);
		if (i !== -1 && i + 1 < row.length) return row[i + 1];
	}
	return null;
}

/** "A$86,971.54" or "$158.1301" -> cents. */
function toCents(raw: string | null): number | null {
	if (!raw) return null;
	const m = raw.replace(/[,\s]/g, '').match(/-?\d+(\.\d+)?/);
	if (!m) return null;
	return Math.round(parseFloat(m[0]) * 100);
}

/** "11-09-2026" (dd-mm-yyyy) -> "2026-09-11". */
function toIsoDate(raw: string | null): string | null {
	if (!raw) return null;
	const m = raw.match(/(\d{2})-(\d{2})-(\d{4})/);
	return m ? `${m[3]}-${m[2]}-${m[1]}` : null;
}

export async function parseContractNote(bytes: Uint8Array): Promise<ParsedContractNote> {
	return fieldsFromRows(await extractRows(await getDocumentProxy(bytes)));
}

/** Exported separately so the field mapping can be tested without a PDF fixture. */
export function fieldsFromRows(rows: string[][]): ParsedContractNote {
	const warnings: string[] = [];
	const flat = rows.flat().join(' ').toUpperCase();

	// The heading is the most reliable signal; the SIDE cell can run into its neighbour.
	const side = flat.includes('SELL CONFIRMATION')
		? 'sell'
		: flat.includes('BUY CONFIRMATION')
			? 'buy'
			: null;
	if (!side) warnings.push('Could not determine whether this is a buy or a sell.');

	const rawTicker = valueAfter(rows, 'TICKER');
	const ticker = rawTicker?.match(/^([A-Z0-9]{1,6})\.ASX$/)?.[1] ?? null;
	if (!ticker) warnings.push('Could not read the ticker.');

	const quantityRaw = valueAfter(rows, 'QUANTITY');
	const quantity = quantityRaw ? parseInt(quantityRaw.replace(/[,\s]/g, ''), 10) : NaN;
	const parsedQuantity = Number.isFinite(quantity) && quantity > 0 ? quantity : null;
	if (!parsedQuantity) warnings.push('Could not read the quantity.');

	const pricePerUnit = toCents(valueAfter(rows, 'EFFECTIVE PRICE'));
	const value = toCents(valueAfter(rows, 'VALUE'));
	const brokerage = toCents(valueAfter(rows, 'BROKERAGE & GST')) ?? 0;
	const netAmount = toCents(valueAfter(rows, 'NET PROCEEDS') ?? valueAfter(rows, 'NET COST'));

	if (value === null) warnings.push('Could not read the trade value.');
	if (pricePerUnit === null) warnings.push('Could not read the effective price.');

	// A sell nets down by brokerage, a buy nets up. Either way the magnitudes must line up.
	if (value !== null && netAmount !== null) {
		const expected = side === 'buy' ? value + brokerage : value - brokerage;
		if (Math.abs(expected - netAmount) > 1) {
			warnings.push(
				`Value and brokerage do not reconcile with the stated net amount (expected ${expected} cents, statement says ${netAmount}).`
			);
		}
	}

	return {
		side,
		ticker,
		quantity: parsedQuantity,
		pricePerUnit,
		value,
		brokerage,
		netAmount,
		executionDate: toIsoDate(valueAfter(rows, 'EXECUTION DATE')),
		settlementDate: toIsoDate(valueAfter(rows, 'SETTLEMENT DATE')),
		confirmationNumber: valueAfter(rows, 'CONFIRMATION NUMBER'),
		platform: BROKERS.find((b) => flat.includes(b.toUpperCase())) ?? null,
		warnings
	};
}
