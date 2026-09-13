import { error } from '@sveltejs/kit';
import { readFile } from 'node:fs/promises';
import { eq } from 'drizzle-orm';
import { db } from '$db';
import { documentTable } from '$db/schemas/portfolio';
import { documentPath } from '#lib/server/documents.js';
import { auth } from '#lib/server/auth.js';
import type { RequestHandler } from './$types';

/*
  Source documents are served through the app rather than from a public folder: the
  store holds contract notes and tax statements, so every read has to check that the
  requester owns the portfolio the document hangs off.
*/
export const GET: RequestHandler = async ({ params, request }) => {
	const session = await auth.api.getSession({ headers: request.headers });
	if (!session?.user) error(401, 'Unauthorized');

	const document = await db.query.documentTable.findFirst({
		where: eq(documentTable.id, params.documentId),
		with: {
			transaction: { with: { holding: { with: { portfolio: true } } } },
			distribution: { with: { holding: { with: { portfolio: true } } } },
			amitStatement: { with: { holding: { with: { portfolio: true } } } }
		}
	});
	if (!document) error(404, 'Document not found');

	const owner =
		document.transaction?.holding.portfolio ??
		document.distribution?.holding.portfolio ??
		document.amitStatement?.holding.portfolio;
	if (owner?.userId !== session.user.id) error(403, 'Forbidden');

	let file: Buffer;
	try {
		file = await readFile(documentPath(document.path));
	} catch {
		// The row outlived the file — a restored database against an empty store, say.
		error(404, 'That file is no longer in the document store.');
	}

	return new Response(new Uint8Array(file), {
		headers: {
			'content-type': document.contentType,
			// Inline: these are read, not collected. The filename still drives Save As.
			'content-disposition': `inline; filename="${document.filename.replace(/["\\]/g, '')}"`,
			'content-length': String(file.byteLength),
			'cache-control': 'private, no-store'
		}
	});
};
