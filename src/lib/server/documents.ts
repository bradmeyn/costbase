import { mkdir, writeFile } from 'node:fs/promises';
import { join, extname } from 'node:path';
import { randomUUID } from 'node:crypto';
import { error } from '@sveltejs/kit';

/*
  Uploaded source documents are written to disk and referenced by path from the
  `document` table, rather than held as blobs in Postgres: it keeps database dumps
  small and the files inspectable.

  Stored names are generated, never taken from the upload — a user-supplied filename
  is untrusted input and must not reach the filesystem.
*/

/** Root of the document store, relative to the working directory. */
export const DOCUMENT_ROOT = 'data/documents';

const MAX_BYTES = 10 * 1024 * 1024;
const ALLOWED = new Set(['application/pdf']);

export interface StoredDocument {
	/** Path relative to DOCUMENT_ROOT. */
	path: string;
	filename: string;
	sizeBytes: number;
	contentType: string;
}

/**
 * Write an uploaded file into the store, foldered by year and month.
 * Returns the metadata to persist against the owning row.
 */
export async function storeDocument(file: File): Promise<StoredDocument> {
	if (!ALLOWED.has(file.type)) {
		error(415, `Only PDF uploads are supported (received ${file.type || 'unknown type'}).`);
	}
	if (file.size === 0) error(400, 'That file is empty.');
	if (file.size > MAX_BYTES) {
		error(413, `That file is ${(file.size / 1024 / 1024).toFixed(1)}MB; the limit is 10MB.`);
	}

	const now = new Date();
	const folder = `${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, '0')}`;
	// Generated name: never trust the uploaded filename on disk.
	const ext = extname(file.name).toLowerCase() === '.pdf' ? '.pdf' : '.pdf';
	const relative = `${folder}/${randomUUID()}${ext}`;

	await mkdir(join(DOCUMENT_ROOT, folder), { recursive: true });
	await writeFile(join(DOCUMENT_ROOT, relative), Buffer.from(await file.arrayBuffer()));

	return {
		path: relative,
		// Keep the original name for display only.
		filename: file.name.slice(0, 200),
		sizeBytes: file.size,
		contentType: file.type
	};
}

/** Absolute-ish path for reading a stored document back. */
export function documentPath(relative: string): string {
	// Guard against a stored path escaping the root.
	if (relative.includes('..')) error(400, 'Invalid document path.');
	return join(DOCUMENT_ROOT, relative);
}
