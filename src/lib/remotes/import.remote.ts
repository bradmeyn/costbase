import { command, form } from '$app/server';
import { z } from 'zod';
import { db } from '$db';
import { documentTable, portfolioTable, transactionTable } from '$db/schemas/portfolio';
import { eq } from 'drizzle-orm';
import { error } from '@sveltejs/kit';
import { getCurrentUser } from '#lib/remotes/auth.remote.js';
import { parseContractNote } from '#lib/server/parse-contract-note.js';
import { storeDocument } from '#lib/server/documents.js';
import { getHolding } from '#lib/remotes/holding.remote.js';
import { getAmitStatements } from '#lib/remotes/amit.remote.js';

/** The portfolio's holdings, keyed by ticker, for matching a parsed note. */
async function ownedPortfolio(portfolioId: string) {
	const user = await getCurrentUser();
	if (!user) error(401, 'Unauthorized');

	const portfolio = await db.query.portfolioTable.findFirst({
		where: eq(portfolioTable.id, portfolioId),
		with: { holdings: { with: { investment: true } } }
	});
	if (!portfolio) error(404, 'Portfolio not found');
	if (portfolio.userId !== user.id) error(403, 'Forbidden');
	return portfolio;
}

/**
 * Read a contract note and report what it contains. Writes nothing: the caller
 * confirms the figures first.
 */
export const previewContractNote = command(
	z.object({ portfolioId: z.string().min(1), file: z.instanceof(File) }),
	async ({ portfolioId, file }) => {
		const portfolio = await ownedPortfolio(portfolioId);
		const parsed = await parseContractNote(new Uint8Array(await file.arrayBuffer()));

		const holding = parsed.ticker
			? portfolio.holdings.find((h) => h.investment.code === parsed.ticker)
			: undefined;

		const warnings = [...parsed.warnings];
		if (parsed.ticker && !holding) {
			warnings.push(
				`No holding for ${parsed.ticker} in this portfolio. Add the holding first, then import the note.`
			);
		}

		// A note already imported would otherwise silently double the position.
		let duplicate = false;
		if (parsed.confirmationNumber) {
			const existing = await db.query.transactionTable.findFirst({
				where: eq(transactionTable.confirmationNumber, parsed.confirmationNumber)
			});
			if (existing) {
				duplicate = true;
				warnings.push(
					`Confirmation ${parsed.confirmationNumber} has already been imported. Importing again would duplicate the trade.`
				);
			}
		}

		return {
			success: true,
			parsed: { ...parsed, warnings },
			duplicate,
			holdingId: holding?.id ?? null,
			holdingName: holding ? `${holding.investment.code} ${holding.investment.name}` : null
		};
	}
);

/** Create the transaction from confirmed figures and attach the source PDF. */
export const importContractNote = form(
	z.object({
		portfolioId: z.string().min(1),
		holdingId: z.string().min(1, 'Choose a holding'),
		type: z.enum(['buy', 'sell', 'reinvestment']),
		quantity: z.number().int().positive('Quantity must be a positive whole number'),
		pricePerUnit: z.number().nonnegative(),
		value: z.number().nonnegative(),
		brokerage: z.number().nonnegative().default(0),
		transactionDate: z.string().min(1, 'Date is required'),
		confirmationNumber: z.string().optional(),
		file: z.instanceof(File)
	}),
	async (data) => {
		const portfolio = await ownedPortfolio(data.portfolioId);
		const holding = portfolio.holdings.find((h) => h.id === data.holdingId);
		if (!holding) error(404, 'Holding not found in this portfolio');

		if (data.confirmationNumber) {
			const existing = await db.query.transactionTable.findFirst({
				where: eq(transactionTable.confirmationNumber, data.confirmationNumber)
			});
			if (existing) error(409, `Confirmation ${data.confirmationNumber} is already imported.`);
		}

		// Store the file first: a failed write must not leave an orphaned transaction.
		const stored = await storeDocument(data.file);

		const [created] = await db
			.insert(transactionTable)
			.values({
				holdingId: holding.id,
				type: data.type,
				quantity: data.quantity,
				pricePerUnit: Math.round(data.pricePerUnit * 100),
				value: Math.round(data.value * 100),
				brokerage: Math.round(data.brokerage * 100),
				transactionDate: new Date(data.transactionDate),
				confirmationNumber: data.confirmationNumber || null
			})
			.returning();

		await db.insert(documentTable).values({ transactionId: created.id, ...stored });

		return { success: true, transactionId: created.id };
	}
);

/** Attach a PDF to an existing transaction, distribution or AMMA statement. */
export const attachDocument = command(
	z.object({
		owner: z.enum(['transaction', 'distribution', 'amitStatement']),
		ownerId: z.string().min(1),
		file: z.instanceof(File)
	}),
	async ({ owner, ownerId, file }) => {
		const user = await getCurrentUser();
		if (!user) error(401, 'Unauthorized');

		// Confirm the row belongs to this user before writing anything to disk.
		const record =
			owner === 'transaction'
				? await db.query.transactionTable.findFirst({
						where: eq(transactionTable.id, ownerId),
						with: { holding: { with: { portfolio: true } } }
					})
				: owner === 'distribution'
					? await db.query.distributionTable.findFirst({
							where: (d, { eq: e }) => e(d.id, ownerId),
							with: { holding: { with: { portfolio: true } } }
						})
					: await db.query.amitStatementTable.findFirst({
							where: (a, { eq: e }) => e(a.id, ownerId),
							with: { holding: { with: { portfolio: true } } }
						});

		if (!record) error(404, 'Record not found');
		if (record.holding.portfolio.userId !== user.id) error(403, 'Forbidden');

		const stored = await storeDocument(file);
		await db.insert(documentTable).values({
			transactionId: owner === 'transaction' ? ownerId : null,
			distributionId: owner === 'distribution' ? ownerId : null,
			amitStatementId: owner === 'amitStatement' ? ownerId : null,
			...stored
		});

		await Promise.all([
			getHolding(record.holdingId).refresh(),
			owner === 'amitStatement' ? getAmitStatements(record.holdingId).refresh() : Promise.resolve()
		]);

		return { success: true };
	}
);

/** Remove an attachment. The file stays on disk; only the link is dropped. */
export const detachDocument = command(z.string().min(1), async (documentId) => {
	const user = await getCurrentUser();
	if (!user) error(401, 'Unauthorized');

	const document = await db.query.documentTable.findFirst({
		where: eq(documentTable.id, documentId),
		with: {
			transaction: { with: { holding: { with: { portfolio: true } } } },
			distribution: { with: { holding: { with: { portfolio: true } } } },
			amitStatement: { with: { holding: { with: { portfolio: true } } } }
		}
	});
	if (!document) error(404, 'Document not found');

	const holding =
		document.transaction?.holding ??
		document.distribution?.holding ??
		document.amitStatement?.holding;
	if (!holding || holding.portfolio.userId !== user.id) error(403, 'Forbidden');

	await db.delete(documentTable).where(eq(documentTable.id, documentId));

	await Promise.all([
		getHolding(holding.id).refresh(),
		document.amitStatementId ? getAmitStatements(holding.id).refresh() : Promise.resolve()
	]);

	return { success: true };
});
