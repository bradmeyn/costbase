/*
  What a document is, and how a date range picks it up.

  The four kinds are dated differently — a trade by the day it executed, a
  distribution by the entitlement behind it, a statement by its financial year —
  so the filter works on a single "as at" date each kind supplies, rather than
  asking every caller to remember which column to compare.
*/

export const DOCUMENT_KINDS = [
	{ value: 'transaction', label: 'Contract notes', folder: 'transactions' },
	{ value: 'distribution', label: 'Distribution statements', folder: 'distributions' },
	{ value: 'amitStatement', label: 'Tax statements (AMMA)', folder: 'tax-statements' },
	{ value: 'annualStatement', label: 'Annual statements', folder: 'annual-statements' }
] as const;

export type DocumentKind = (typeof DOCUMENT_KINDS)[number]['value'];

export function kindLabel(kind: DocumentKind): string {
	return DOCUMENT_KINDS.find((k) => k.value === kind)?.label ?? kind;
}

export function kindFolder(kind: DocumentKind): string {
	return DOCUMENT_KINDS.find((k) => k.value === kind)?.folder ?? 'other';
}

export interface PortfolioDocument {
	id: string;
	kind: DocumentKind;
	code: string;
	/** The name the file is given wherever it is served or packed. */
	name: string;
	/** The original upload's name, kept for reference. */
	filename: string;
	sizeBytes: number;
	path: string;
	/*
	  Two dates, because for a distribution they genuinely differ. `dated` is the day
	  printed on the document and used in its name; `asAt` is the day a date filter
	  compares against, which for a distribution is the entitlement behind it — a
	  June-quarter statement paid in July belongs with the year it was declared for.
	  Everything else sets both to the same day.
	*/
	dated: string;
	asAt: string;
	/** Shown alongside, since a statement's date is its year rather than a day. */
	financialYear: number | null;
}

export interface DocumentFilter {
	from?: string;
	to?: string;
	kinds?: DocumentKind[];
	codes?: string[];
}

/** An absent bound or an empty list does not filter — that is what "all" sends. */
export function filterDocuments(
	documents: PortfolioDocument[],
	filter: DocumentFilter
): PortfolioDocument[] {
	return documents.filter((d) => {
		if (filter.from && d.asAt < filter.from) return false;
		if (filter.to && d.asAt > filter.to) return false;
		if (filter.kinds?.length && !filter.kinds.includes(d.kind)) return false;
		if (filter.codes?.length && !filter.codes.includes(d.code)) return false;
		return true;
	});
}

/*
  Lays the chosen documents out as zip entries, foldered by holding and kind:

    vas/transactions/2026_03_02_buy_vas_6_units_stake.pdf
    vas/tax-statements/fy_25_26_tax_statement_vas.pdf

  Which is the shape the files are kept in outside the app, so an export can be
  dropped into an existing folder of paperwork without rearranging it.

  `read` is passed in so the layout can be tested without touching the store. A file
  the store has lost is listed in MISSING.txt rather than failing the whole export —
  an archive that is honest about one gap beats no archive at all.
*/
export async function buildZipEntries(
	documents: PortfolioDocument[],
	read: (path: string) => Promise<Uint8Array | null>
): Promise<Record<string, Uint8Array>> {
	const files: Record<string, Uint8Array> = {};
	const missing: string[] = [];

	for (const document of documents) {
		const bytes = await read(document.path);
		if (!bytes) {
			missing.push(document.name);
			continue;
		}
		const folder = `${document.code.toLowerCase()}/${kindFolder(document.kind)}`;
		/*
		  Two documents against one row would collide on name — rare, but it would
		  silently drop one, so later copies are numbered.
		*/
		let entry = `${folder}/${document.name}`;
		for (let n = 2; entry in files; n++) {
			entry = `${folder}/${document.name.replace(/\.pdf$/, '')}_${n}.pdf`;
		}
		files[entry] = bytes;
	}

	if (missing.length > 0) {
		files['MISSING.txt'] = new TextEncoder().encode(
			`These documents are recorded but their files were not in the store:\n\n${missing.join('\n')}\n`
		);
	}
	return files;
}
