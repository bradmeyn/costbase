import { command, form, query } from '$app/server';
import { z } from 'zod';
import { getCurrentUser } from '#lib/remotes/auth.remote.js';
import { db } from '#lib/server/db/index.js';
import { documentTable, transactionTable, holdingTable } from '#lib/server/db/schemas/portfolio.js';
import { eq } from 'drizzle-orm';
import { error, invalid } from '@sveltejs/kit';
import { getHolding } from './holding.remote';
import { transactionSchema, updateTransactionSchema } from '#lib/schemas/portfolio.js';
import { fieldsFromRows, looksLikeContractNote } from '#lib/server/parse-contract-note.js';
import { extractRows } from '#lib/server/pdf-rows.js';
import { getDocumentProxy } from 'unpdf';
import { storeDocument } from '#lib/server/documents.js';

export const getTransactions = query(z.string(), async (holdingId: string) => {
	const user = await getCurrentUser();
	if (!user) error(401, 'Unauthorized');

	// Verify user owns the holding
	const holding = await db.query.holdingTable.findFirst({
		where: eq(holdingTable.id, holdingId),
		with: {
			portfolio: true
		}
	});

	if (!holding) error(404, 'Holding not found');
	if (holding.portfolio.userId !== user.id) error(403, 'Forbidden');

	const transactions = await db.query.transactionTable.findMany({
		where: eq(transactionTable.holdingId, holdingId)
	});

	return transactions;
});

export const getTransaction = query(z.string(), async (id: string) => {
	const user = await getCurrentUser();
	if (!user) error(401, 'Unauthorized');

	const transaction = await db.query.transactionTable.findFirst({
		where: eq(transactionTable.id, id),
		with: {
			holding: {
				with: {
					portfolio: true
				}
			}
		}
	});

	if (!transaction) error(404, 'Transaction not found');
	if (transaction.holding.portfolio.userId !== user.id) error(403, 'Forbidden');

	return transaction;
});

/**
 * Read a broker's trade confirmation dropped onto the add dialog, to fill a row.
 * Writes nothing: the figures land in the form for the user to check and submit.
 */
export const readContractNote = command(
	z.object({ holdingId: z.string().min(1), file: z.instanceof(File) }),
	async ({ holdingId, file }) => {
		const user = await getCurrentUser();
		if (!user) error(401, 'Unauthorized');

		const holding = await db.query.holdingTable.findFirst({
			where: eq(holdingTable.id, holdingId),
			with: { portfolio: true, investment: true, transactions: true }
		});

		if (!holding) error(404, 'Holding not found');
		if (holding.portfolio.userId !== user.id) error(403, 'Forbidden');

		const rows = await extractRows(
			await getDocumentProxy(new Uint8Array(await file.arrayBuffer()))
		);
		if (!looksLikeContractNote(rows)) {
			return { ok: false as const, reason: `${file.name} is not a trade confirmation.` };
		}

		const parsed = fieldsFromRows(rows);
		const warnings = [...parsed.warnings];

		// Codes are stored bare (VGS), but compare bare on both sides in case one is not.
		const bare = (code: string) => code.trim().toUpperCase().split('.')[0];
		if (parsed.ticker && bare(parsed.ticker) !== bare(holding.investment.code)) {
			return {
				ok: false as const,
				reason: `${file.name} is a ${parsed.ticker} trade, not ${holding.investment.code}.`
			};
		}

		/*
		  Same checks as the import page: a note imported before carries its confirmation
		  number, and a trade typed in by hand is recognised by day, side and quantity.
		*/
		const isoDay = (d: Date) =>
			`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
		const duplicate = holding.transactions.some(
			(t) =>
				(parsed.confirmationNumber && t.confirmationNumber === parsed.confirmationNumber) ||
				(t.type === parsed.side &&
					t.quantity === parsed.quantity &&
					isoDay(new Date(t.transactionDate)) === parsed.executionDate)
		);
		if (duplicate) warnings.push(`${file.name} looks like a trade already recorded here.`);

		return { ok: true as const, parsed: { ...parsed, warnings } };
	}
);

/*
  A row filled from a dropped trade confirmation carries the note with it, so the PDF
  is filed against the trade and its confirmation number guards against a re-import.
*/
const addedTransactionSchema = transactionSchema.extend({
	confirmationNumber: z.string().optional(),
	/** The note's stated consideration, in cents. */
	value: z.number().int().nonnegative().optional(),
	note: z.instanceof(File).optional()
});

/**
 * Insert a batch of rows for one holding, filing any note that came with a row.
 * `reject` reports a row that would double a trade already recorded, in whichever
 * way the caller surfaces a problem with its input.
 */
async function insertTransactions(
	holdingId: string,
	transactions: z.infer<typeof addedTransactionSchema>[],
	reject: (message: string) => never
) {
	const user = await getCurrentUser();
	if (!user) error(401, 'Unauthorized');

	// Verify user owns the holding
	const holding = await db.query.holdingTable.findFirst({
		where: eq(holdingTable.id, holdingId),
		with: {
			portfolio: true
		}
	});

	if (!holding) error(404, 'Holding not found');
	if (holding.portfolio.userId !== user.id) error(403, 'Forbidden');

	// Two notes for the same trade, or one already imported, would double it.
	const seen = new Set<string>();
	for (const t of transactions) {
		if (!t.confirmationNumber) continue;
		if (seen.has(t.confirmationNumber)) {
			reject(`Confirmation ${t.confirmationNumber} appears twice.`);
		}
		seen.add(t.confirmationNumber);
		const existing = await db.query.transactionTable.findFirst({
			where: eq(transactionTable.confirmationNumber, t.confirmationNumber)
		});
		if (existing) reject(`Confirmation ${t.confirmationNumber} is already recorded.`);
	}

	// Files first: a failed write must not leave transactions with no document.
	const stored = await Promise.all(
		transactions.map((t) => (t.note && t.note.size > 0 ? storeDocument(t.note) : null))
	);

	// Convert prices to cents and prepare batch insert
	const transactionsToInsert = transactions.map((t) => {
		const pricePerUnit = Math.round(t.pricePerUnit * 100);
		/*
		  The note's value is kept only while it still describes the row: once the
		  quantity or price is edited, it no longer does, beyond the rounding of a
		  four-decimal broker price to cents.
		*/
		const value =
			t.value !== undefined && Math.abs(t.value - pricePerUnit * t.quantity) <= t.quantity
				? t.value
				: null;
		return {
			holdingId,
			quantity: t.quantity,
			pricePerUnit,
			value,
			brokerage: Math.round((t.brokerage || 0) * 100),
			transactionDate: new Date(t.transactionDate),
			type: t.type,
			confirmationNumber: t.confirmationNumber || null,
			platform: t.platform || null
		};
	});

	const newTransactions = await db
		.insert(transactionTable)
		.values(transactionsToInsert)
		.returning();

	const documents = newTransactions.flatMap((t, i) =>
		stored[i] ? [{ transactionId: t.id, ...stored[i] }] : []
	);
	if (documents.length > 0) await db.insert(documentTable).values(documents);

	// Refresh holding (includes transactions) and transactions list
	await Promise.all([getTransactions(holdingId).refresh(), getHolding(holdingId).refresh()]);

	return newTransactions;
}

export const addTransactions = form(
	z.object({
		holdingId: z.string(),
		transactions: z.array(addedTransactionSchema)
	}),
	async ({ holdingId, transactions }) => {
		const created = await insertTransactions(holdingId, transactions, (m) => invalid(m));
		return { success: true, transactions: created };
	}
);

/** Rows read from a CSV, confirmed on the import dialog. */
export const importTransactions = command(
	z.object({
		holdingId: z.string().min(1),
		transactions: z.array(transactionSchema).min(1, 'There are no rows to import')
	}),
	async ({ holdingId, transactions }) => {
		const created = await insertTransactions(holdingId, transactions, (m) => error(409, m));
		return { success: true, created: created.length };
	}
);

export const addTransaction = form(
	z.object({
		holdingId: z.string(),
		quantity: z.number().min(1, 'Quantity must be at least 1'),
		pricePerUnit: z.number().min(0, 'Price per unit must be positive'),
		brokerage: z.number().min(0, 'Brokerage must be positive').default(0),
		transactionDate: z.string(),
		type: z.enum(['buy', 'sell', 'reinvestment'], {
			message: 'Type must be buy, sell, or reinvestment'
		}),
		platform: z.string().optional()
	}),
	async ({ holdingId, quantity, pricePerUnit, brokerage, transactionDate, type, platform }) => {
		const user = await getCurrentUser();
		if (!user) error(401, 'Unauthorized');

		// Verify user owns the holding
		const holding = await db.query.holdingTable.findFirst({
			where: eq(holdingTable.id, holdingId),
			with: {
				portfolio: true
			}
		});

		if (!holding) error(404, 'Holding not found');
		if (holding.portfolio.userId !== user.id) error(403, 'Forbidden');

		// Convert price to cents (integer)
		const priceInCents = Math.round(pricePerUnit * 100);
		const brokerageInCents = Math.round((brokerage || 0) * 100);

		const [newTransaction] = await db
			.insert(transactionTable)
			.values({
				holdingId,
				quantity,
				pricePerUnit: priceInCents,
				brokerage: brokerageInCents,
				transactionDate: new Date(transactionDate),
				type,
				platform: platform || null
			})
			.returning();

		// Refresh holding (includes transactions) and transactions list
		await Promise.all([getTransactions(holdingId).refresh(), getHolding(holdingId).refresh()]);

		return { success: true, transaction: newTransaction };
	}
);

export const updateTransaction = form(
	updateTransactionSchema,
	async ({ id, quantity, pricePerUnit, brokerage, transactionDate, type, platform }) => {
		const user = await getCurrentUser();
		if (!user) error(401, 'Unauthorized');

		const transaction = await db.query.transactionTable.findFirst({
			where: eq(transactionTable.id, id),
			with: {
				holding: {
					with: {
						portfolio: true
					}
				}
			}
		});

		if (!transaction) error(404, 'Transaction not found');
		if (transaction.holding.portfolio.userId !== user.id) error(403, 'Forbidden');

		// Convert price to cents (integer)
		const priceInCents = Math.round(pricePerUnit * 100);
		const brokerageInCents = Math.round((brokerage || 0) * 100);

		const [updatedTransaction] = await db
			.update(transactionTable)
			.set({
				quantity,
				pricePerUnit: priceInCents,
				brokerage: brokerageInCents,
				transactionDate: new Date(transactionDate),
				type,
				platform: platform || null
			})
			.where(eq(transactionTable.id, id))
			.returning();
		await getHolding(transaction.holdingId).refresh();

		return { success: true, transaction: updatedTransaction };
	}
);

export const deleteTransaction = command(
	z.object({
		id: z.string()
	}),
	async ({ id }) => {
		const user = await getCurrentUser();
		if (!user) error(401, 'Unauthorized');

		const transaction = await db.query.transactionTable.findFirst({
			where: eq(transactionTable.id, id),
			with: {
				holding: {
					with: {
						portfolio: true
					}
				}
			}
		});

		if (!transaction) error(404, 'Transaction not found');
		if (transaction.holding.portfolio.userId !== user.id) error(403, 'Forbidden');

		await db.delete(transactionTable).where(eq(transactionTable.id, id));

		await Promise.all([
			getTransactions(transaction.holdingId).refresh(),
			getHolding(transaction.holdingId).refresh()
		]);

		return { success: true };
	}
);
