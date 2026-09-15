import { getDocumentProxy } from 'unpdf';
import { extractRows, isoFromLongDate } from './pdf-rows.js';
import { PLATFORMS } from '#lib/platforms.js';

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
  The same text with every space removed. PDF extraction splits a word at a ligature
  — "Buy Confirmation" arrives as "Buy Con", "fi", "rmation" — so a heading cannot be
  matched by joining the cells with spaces.
*/
function squash(rows: string[][]): string {
	return rows.flat().join('').toUpperCase().replace(/\s+/g, '');
}

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

/**
 * Whether these rows are a broker's trade confirmation.
 *
 * Brokers head the document differently — Stake labels a confirmation number,
 * SelfWealth names itself and says which way the trade went — so several signals are
 * accepted rather than one house style.
 */
export function looksLikeContractNote(rows: string[][]): boolean {
	const squashed = squash(rows);
	return (
		squashed.includes('CONFIRMATIONNUMBER') ||
		squashed.includes('BUYCONFIRMATION') ||
		squashed.includes('SELLCONFIRMATION') ||
		squashed.includes('WEHAVEBOUGHT') ||
		squashed.includes('WEHAVESOLD')
	);
}

/**
 * Exported separately so the field mapping can be tested without a PDF fixture.
 *
 * Brokers agree on nothing but the facts. The layout is identified first and the
 * right mapping applied, rather than trying to find one set of labels that fits
 * every note.
 */
export function fieldsFromRows(rows: string[][]): ParsedContractNote {
	if (squash(rows).includes('SELFWEALTH')) return selfWealthFields(rows);
	return stakeFields(rows);
}

/**
 * SelfWealth, cleared by OpenMarkets and later FNZ. The trade sits in one row under
 * a header, and the net line is named differently on a buy and a sell.
 */
function selfWealthFields(rows: string[][]): ParsedContractNote {
	const warnings: string[] = [];
	const squashed = squash(rows);

	// "We have sold on your account" is the plainest statement of side on the note.
	const side =
		squashed.includes('WEHAVESOLD') || squashed.includes('SELLCONFIRMATION')
			? 'sell'
			: squashed.includes('WEHAVEBOUGHT') || squashed.includes('BUYCONFIRMATION')
				? 'buy'
				: null;
	if (!side) warnings.push('Could not determine whether this is a buy or a sell.');

	/*
	  The trade row is read from its end — currency, consideration, price — because the
	  security description is free text that can occupy a different number of cells,
	  and the header above it carries a footnote marker that the row does not.
	*/
	const tradeRow = rows.find(
		(row) =>
			row.length >= 5 &&
			/^\d[\d,]*$/.test(row[0]) &&
			/^[A-Z]{2,5}$/.test(row[1]) &&
			row[row.length - 1] === 'AUD'
	);

	let ticker: string | null = null;
	let quantity: number | null = null;
	let pricePerUnit: number | null = null;
	let value: number | null = null;

	if (!tradeRow) {
		warnings.push('Could not find the trade line on this note.');
	} else {
		ticker = tradeRow[1];
		const parsedQuantity = parseInt(tradeRow[0].replace(/,/g, ''), 10);
		quantity = Number.isFinite(parsedQuantity) && parsedQuantity > 0 ? parsedQuantity : null;
		pricePerUnit = toCents(tradeRow[tradeRow.length - 3]);
		value = toCents(tradeRow[tradeRow.length - 2]);

		if (!quantity) warnings.push('Could not read the quantity.');
		if (pricePerUnit === null) warnings.push('Could not read the price.');
		if (value === null) warnings.push('Could not read the consideration.');
	}

	/*
	  Every charge on the note is a cost of the trade, so they are summed rather than
	  taking brokerage alone. If one is missed the reconciliation below says so.
	*/
	const brokerage =
		(toCents(valueAfter(rows, 'BROKERAGE*')) ?? 0) +
		(toCents(valueAfter(rows, 'MISC FEES & CHARGES')) ?? 0) +
		(toCents(valueAfter(rows, 'ADVISER FEE*')) ?? 0);

	const netAmount = toCents(
		valueAfter(rows, 'NET VALUE') ?? valueAfter(rows, 'TOTAL AMOUNT PAYABLE')
	);

	if (value !== null && netAmount !== null) {
		const expected = side === 'buy' ? value + brokerage : value - brokerage;
		if (Math.abs(expected - netAmount) > 1) {
			warnings.push(
				`Consideration and fees do not reconcile with the stated net amount (expected ${expected} cents, note says ${netAmount}).`
			);
		}
	}

	return {
		side,
		ticker,
		quantity,
		pricePerUnit,
		value,
		brokerage,
		netAmount,
		executionDate: isoFromLongDate(valueAfter(rows, 'TRADE DATE:')),
		settlementDate: isoFromLongDate(valueAfter(rows, 'SETTLEMENT DATE:')),
		confirmationNumber: valueAfter(rows, 'REFERENCE NO:'),
		platform: 'SelfWealth',
		warnings
	};
}

/** Stake, whose notes are a grid of LABEL/value pairs. */
function stakeFields(rows: string[][]): ParsedContractNote {
	const warnings: string[] = [];
	const squashed = squash(rows);

	// The heading is the most reliable signal; the SIDE cell can run into its neighbour.
	const side = squashed.includes('SELLCONFIRMATION')
		? 'sell'
		: squashed.includes('BUYCONFIRMATION')
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
		platform: PLATFORMS.find((b) => squashed.includes(b.toUpperCase())) ?? null,
		warnings
	};
}
