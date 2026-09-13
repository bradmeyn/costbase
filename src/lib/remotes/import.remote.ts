import { command } from '$app/server';
import { z } from 'zod';
import { db } from '$db';
import {
	distributionTable,
	documentTable,
	portfolioTable,
	transactionTable
} from '$db/schemas/portfolio';
import { eq } from 'drizzle-orm';
import { error } from '@sveltejs/kit';
import { getCurrentUser } from '#lib/remotes/auth.remote.js';
import { fieldsFromRows } from '#lib/server/parse-contract-note.js';
import { distributionFromRows } from '#lib/server/parse-distribution-statement.js';
import { extractRows } from '#lib/server/pdf-rows.js';
import { getDocumentProxy } from 'unpdf';
import { storeDocument } from '#lib/server/documents.js';
import { getHolding } from '#lib/remotes/holding.remote.js';
import { getAmitStatements } from '#lib/remotes/amit.remote.js';

/** The portfolio's holdings, keyed by ticker, for matching a parsed note. */
async function ownedPortfolio(portfolioId: string) {
	const user = await getCurrentUser();
	if (!user) error(401, 'Unauthorized');

	const portfolio = await db.query.portfolioTable.findFirst({
		where: eq(portfolioTable.id, portfolioId),
		with: { holdings: { with: { investment: true, transactions: true } } }
	});
	if (!portfolio) error(404, 'Portfolio not found');
	if (portfolio.userId !== user.id) error(403, 'Forbidden');
	return portfolio;
}

type OwnedPortfolio = Awaited<ReturnType<typeof ownedPortfolio>>;

/**
 * Read an uploaded PDF and report what it contains. Writes nothing: the caller
 * confirms the figures first.
 *
 * The document says what it is, so the user does not have to pick a type before
 * uploading — a trade confirmation and a distribution statement are told apart by
 * their own headings.
 */
export const previewImport = command(
	z.object({ portfolioId: z.string().min(1), file: z.instanceof(File) }),
	async ({ portfolioId, file }) => {
		const portfolio = await ownedPortfolio(portfolioId);
		const rows = await extractRows(
			await getDocumentProxy(new Uint8Array(await file.arrayBuffer()))
		);
		const flat = rows.flat().join(' ').toUpperCase();

		if (flat.includes('CONFIRMATION NUMBER')) {
			return { kind: 'contract-note' as const, ...(await contractNotePreview(portfolio, rows)) };
		}
		if (flat.includes('DISTRIBUTION PAYMENT')) {
			return {
				kind: 'distribution-statement' as const,
				...(await distributionPreview(portfolio, rows))
			};
		}
		return { kind: 'unknown' as const };
	}
);

async function contractNotePreview(portfolio: OwnedPortfolio, rows: string[][]) {
	const parsed = fieldsFromRows(rows);

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
		parsed: { ...parsed, warnings },
		duplicate,
		holdingId: holding?.id ?? null,
		holdingName: holding ? `${holding.investment.code} ${holding.investment.name}` : null
	};
}

/** Create the transaction from confirmed figures and attach the source PDF. */
export const importContractNote = command(
	z.object({
		portfolioId: z.string().min(1),
		holdingId: z.string().min(1, 'Choose a holding'),
		type: z.enum(['buy', 'sell', 'reinvestment']),
		quantity: z.number().int().positive('Quantity must be a positive whole number'),
		/** Cents. */
		pricePerUnit: z.number().int().nonnegative(),
		value: z.number().int().nonnegative(),
		brokerage: z.number().int().nonnegative(),
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
				pricePerUnit: data.pricePerUnit,
				value: data.value,
				brokerage: data.brokerage,
				transactionDate: new Date(data.transactionDate),
				confirmationNumber: data.confirmationNumber || null
			})
			.returning();

		await db.insert(documentTable).values({ transactionId: created.id, ...stored });
		await getHolding(holding.id).refresh();

		return { success: true, transactionId: created.id };
	}
);

/**
 * One statement covers every holding paid on the same date, so this returns a row
 * per holding for the caller to confirm together.
 */
async function distributionPreview(portfolio: OwnedPortfolio, sourceRows: string[][]) {
	const parsed = distributionFromRows(sourceRows);

	const recordDate = parsed.recordDate ? new Date(parsed.recordDate) : null;
	const paymentDate = parsed.paymentDate ? new Date(parsed.paymentDate) : null;

	const rows = await Promise.all(
		parsed.rows.map(async (row) => {
			const holding = portfolio.holdings.find((h) => h.investment.code === row.ticker);
			const notes: string[] = [];

			if (!holding) {
				notes.push(
					`No holding for ${row.ticker} in this portfolio. Add the holding first, then import the statement.`
				);
			}

			// The registry's unit count is the one that was paid. A difference means
			// the app's transactions are incomplete, which is worth seeing before saving.
			if (holding && recordDate && row.units !== null) {
				const held = holding.transactions
					.filter((t) => new Date(t.transactionDate) <= recordDate)
					.reduce((sum, t) => sum + (t.type === 'sell' ? -t.quantity : t.quantity), 0);
				if (held !== row.units) {
					notes.push(
						`The statement says ${row.units} units at the record date; this portfolio has ${held}.`
					);
				}
			}

			let duplicate = false;
			if (holding && paymentDate) {
				const existing = await db.query.distributionTable.findFirst({
					where: (d, { and, eq: e }) => and(e(d.holdingId, holding.id), e(d.datePaid, paymentDate))
				});
				if (existing) {
					duplicate = true;
					notes.push(
						`A ${row.ticker} distribution paid on ${parsed.paymentDate} is already recorded.`
					);
				}
			}

			return {
				...row,
				holdingId: holding?.id ?? null,
				holdingName: holding ? `${holding.investment.code} ${holding.investment.name}` : null,
				duplicate,
				notes
			};
		})
	);

	return { statement: { ...parsed, rows: undefined }, rows };
}

/** Create one distribution per confirmed row and attach the statement to each. */
export const importDistributionStatement = command(
	z.object({
		portfolioId: z.string().min(1),
		file: z.instanceof(File),
		/** ISO dates. */
		paymentDate: z.string().min(1),
		recordDate: z.string().optional(),
		rows: z
			.array(
				z.object({
					holdingId: z.string().min(1),
					units: z.number().int().nonnegative(),
					/** Millionths of a cent. */
					centsPerUnit: z.number().int().nonnegative(),
					grossPayment: z.number().int().nonnegative(),
					taxWithheld: z.number().int().nonnegative(),
					reinvested: z.boolean()
				})
			)
			.min(1, 'Choose at least one holding to import')
	}),
	async ({ portfolioId, file, paymentDate, recordDate, rows }) => {
		const portfolio = await ownedPortfolio(portfolioId);
		const datePaid = new Date(paymentDate);

		for (const row of rows) {
			if (!portfolio.holdings.some((h) => h.id === row.holdingId)) {
				error(404, 'Holding not found in this portfolio');
			}
			const existing = await db.query.distributionTable.findFirst({
				where: (d, { and, eq: e }) => and(e(d.holdingId, row.holdingId), e(d.datePaid, datePaid))
			});
			if (existing) error(409, `A distribution paid on ${paymentDate} is already recorded.`);
		}

		// Store the file once: a failed write must not leave orphaned distributions.
		const stored = await storeDocument(file);

		const created = await db
			.insert(distributionTable)
			.values(
				rows.map((row) => ({
					holdingId: row.holdingId,
					datePaid,
					recordDate: recordDate ? new Date(recordDate) : null,
					units: row.units,
					centsPerUnit: row.centsPerUnit,
					grossPayment: row.grossPayment,
					taxWithheld: row.taxWithheld,
					reinvested: row.reinvested
				}))
			)
			.returning();

		// The same statement backs every row it created, so each gets its own link.
		await db
			.insert(documentTable)
			.values(created.map((d) => ({ distributionId: d.id, ...stored })));

		await Promise.all(rows.map((row) => getHolding(row.holdingId).refresh()));

		return { success: true, created: created.length };
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
