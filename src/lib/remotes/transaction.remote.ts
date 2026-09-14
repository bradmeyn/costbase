import { command, form, query } from '$app/server';
import { z } from 'zod';
import { getCurrentUser } from '#lib/remotes/auth.remote.js';
import { db } from '$db';
import { transactionTable, holdingTable } from '$db/schemas/portfolio';
import { eq } from 'drizzle-orm';
import { error } from '@sveltejs/kit';
import { getHolding } from './holding.remote';
import { transactionSchema, updateTransactionSchema } from '#lib/schemas/portfolio.js';

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

export const addTransactions = form(
	z.object({
		holdingId: z.string(),
		transactions: z.array(transactionSchema)
	}),
	async ({ holdingId, transactions }) => {
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

		// Convert prices to cents and prepare batch insert
		const transactionsToInsert = transactions.map((t) => ({
			holdingId,
			quantity: t.quantity,
			pricePerUnit: Math.round(t.pricePerUnit * 100),
			brokerage: Math.round((t.brokerage || 0) * 100),
			transactionDate: new Date(t.transactionDate),
			type: t.type,
			platform: t.platform || null
		}));

		const newTransactions = await db
			.insert(transactionTable)
			.values(transactionsToInsert)
			.returning();

		// Refresh holding (includes transactions) and transactions list
		await Promise.all([getTransactions(holdingId).refresh(), getHolding(holdingId).refresh()]);

		return { success: true, transactions: newTransactions };
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
