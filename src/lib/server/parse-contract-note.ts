import { getDocumentProxy } from 'unpdf';

/*
  Parses a Stake ASX trade confirmation.

  The PDF is absolutely positioned, so reading the extracted text in stream order
  interleaves labels and values ("SELLBROKERAGE & GST"). Instead the text items are
  regrouped into visual rows by their y coordinate and ordered by x, which restores
  the "LABEL  value" pairs the document actually shows.

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
	/** Anything that did not parse, or arithmetic that did not reconcile. */
	warnings: string[];
}

/** Rebuild visual rows from absolutely positioned text items. */
async function extractRows(bytes: Uint8Array): Promise<string[][]> {
	const pdf = await getDocumentProxy(bytes);
	const rows = new Map<number, { x: number; s: string }[]>();

	for (let n = 1; n <= pdf.numPages; n++) {
		const content = await (await pdf.getPage(n)).getTextContent();
		for (const item of content.items as { str: string; transform: number[] }[]) {
			if (!item.str.trim()) continue;
			const y = Math.round(item.transform[5]);
			// Items on the same visual line can differ by a point or two.
			const key = [...rows.keys()].find((k) => Math.abs(k - y) <= 3) ?? y;
			if (!rows.has(key)) rows.set(key, []);
			rows.get(key)!.push({ x: item.transform[4], s: item.str.trim() });
		}
	}

	return [...rows.entries()]
		.sort((a, b) => b[0] - a[0])
		.map(([, items]) =>
			items
				.sort((a, b) => a.x - b.x)
				.map((i) => i.s)
				.filter(Boolean)
		);
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
	return fieldsFromRows(await extractRows(bytes));
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
		warnings
	};
}
