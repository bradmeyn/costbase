import { error } from '@sveltejs/kit';
import { readFile } from 'node:fs/promises';
import { zipSync } from 'fflate';
import { auth } from '#lib/server/auth.js';
import { documentPath } from '#lib/server/documents.js';
import { loadPortfolioDocuments } from '#lib/server/portfolio-documents.js';
import { buildZipEntries, filterDocuments, type DocumentKind } from '#lib/documents-filter.js';
import { financialYearLabel, isoDay } from '#lib/report-period.js';
import { readList } from '#lib/report-query.js';
import type { RequestHandler } from './$types';

const isoDateParam = (value: string | null) =>
	value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : undefined;

/** A tag for the filename: the financial year when the range is exactly one. */
function rangeTag(from?: string, to?: string): string {
	if (!from && !to) return 'all';
	if (from && to) {
		const year = Number(to.slice(0, 4));
		const fy = { from: `${year - 1}-07-01`, to: `${year}-06-30` };
		if (from === fy.from && to === fy.to) return financialYearLabel(year).toLowerCase();
	}
	return `${from ?? 'start'}_to_${to ?? isoDay(new Date())}`;
}

/*
  The portfolio's source documents as one zip.

  Built in memory rather than streamed: the whole store is about 20MB, and a request
  that either succeeds with a complete archive or fails cleanly is worth more here
  than one that can half-write a file someone is about to send to their accountant.
*/
export const GET: RequestHandler = async ({ params, request, url }) => {
	const session = await auth.api.getSession({ headers: request.headers });
	if (!session?.user) error(401, 'Unauthorized');

	const all = await loadPortfolioDocuments(params.portfolioId, session.user.id);

	const from = isoDateParam(url.searchParams.get('from'));
	const to = isoDateParam(url.searchParams.get('to'));
	// Comma-separated, matching the filters the page writes into the same query.
	const kinds = readList(url, 'kind') as DocumentKind[];
	const codes = readList(url, 'holding');

	const chosen = filterDocuments(all, { from, to, kinds, codes });
	if (chosen.length === 0) error(404, 'No documents match that selection.');

	const files = await buildZipEntries(chosen, async (path) => {
		try {
			return new Uint8Array(await readFile(documentPath(path)));
		} catch {
			// The row outlived the file — a restored database against an empty store.
			return null;
		}
	});

	// Store rather than deflate: PDFs are already compressed, and this is faster.
	const zipped = zipSync(files, { level: 0 });
	const name = `documents_${rangeTag(from, to)}.zip`;

	return new Response(new Uint8Array(zipped), {
		headers: {
			'content-type': 'application/zip',
			'content-disposition': `attachment; filename="${name}"`,
			'content-length': String(zipped.byteLength),
			'cache-control': 'private, no-store'
		}
	});
};
