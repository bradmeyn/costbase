import type { getDocumentProxy } from 'unpdf';

type PDFDocument = Awaited<ReturnType<typeof getDocumentProxy>>;

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

/** "8 Mar 2022" or "2 July 2026" -> "2022-03-08". Month names, not numbers. */
export function isoFromLongDate(raw: string | null | undefined): string | null {
	if (!raw) return null;
	const m = raw.match(/(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})/);
	if (!m) return null;
	const month = MONTHS.indexOf(m[2].slice(0, 3).toLowerCase());
	if (month === -1) return null;
	return `${m[3]}-${String(month + 1).padStart(2, '0')}-${m[1].padStart(2, '0')}`;
}

/*
  Broker and registry PDFs are absolutely positioned, so reading the extracted text
  in stream order interleaves labels and values ("SELLBROKERAGE & GST"). Regrouping
  the items by y coordinate and ordering by x restores the rows the document shows.
*/
export async function extractRows(pdf: PDFDocument): Promise<string[][]> {
	const pages: string[][] = [];

	for (let n = 1; n <= pdf.numPages; n++) {
		const content = await (await pdf.getPage(n)).getTextContent();
		// Clustered per page: y coordinates restart on every page, so pooling them
		// would splice a later page's lines into an earlier one.
		const rows = new Map<number, { x: number; s: string }[]>();

		for (const item of content.items as { str: string; transform: number[] }[]) {
			if (!item.str.trim()) continue;
			const y = Math.round(item.transform[5]);
			// Items on the same visual line can differ by a point or two.
			const key = [...rows.keys()].find((k) => Math.abs(k - y) <= 3) ?? y;
			if (!rows.has(key)) rows.set(key, []);
			rows.get(key)!.push({ x: item.transform[4], s: item.str.trim() });
		}

		for (const [, items] of [...rows.entries()].sort((a, b) => b[0] - a[0])) {
			pages.push(
				items
					.sort((a, b) => a.x - b.x)
					.map((i) => i.s)
					.filter(Boolean)
			);
		}
	}

	return pages;
}
