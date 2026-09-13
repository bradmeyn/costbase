import { form, query } from '$app/server';
import { z } from 'zod';
import { getCurrentUser } from '#lib/remotes/auth.remote.js';
import { db } from '$db';
import { amitStatementTable, holdingTable } from '$db/schemas/portfolio';
import { eq } from 'drizzle-orm';
import { error } from '@sveltejs/kit';
import {
	amitStatementSchema,
	AMIT_AMOUNT_FIELDS,
	type AmitAmountField
} from '#lib/schemas/amit.js';

/** Dollars as entered on the statement -> cents for storage. */
function toCents(dollars: number): number {
	return Math.round(dollars * 100);
}

function amountsToCents(input: Record<string, unknown>) {
	return Object.fromEntries(
		AMIT_AMOUNT_FIELDS.map((f) => [f, toCents(Number(input[f as AmitAmountField] ?? 0))])
	);
}

/** Confirm the signed-in user owns the portfolio this holding belongs to. */
async function assertOwnsHolding(holdingId: string) {
	const user = await getCurrentUser();
	if (!user) error(401, 'Unauthorized');

	const holding = await db.query.holdingTable.findFirst({
		where: eq(holdingTable.id, holdingId),
		with: { portfolio: true, investment: true }
	});

	if (!holding) error(404, 'Holding not found');
	if (holding.portfolio.userId !== user.id) error(403, 'Forbidden');
	return holding;
}

export const getAmitStatements = query(z.string(), async (holdingId: string) => {
	await assertOwnsHolding(holdingId);

	return db.query.amitStatementTable.findMany({
		where: eq(amitStatementTable.holdingId, holdingId),
		with: { documents: true },
		orderBy: (s, { desc }) => [desc(s.financialYear)]
	});
});

/** Every statement across a portfolio, for the tax report. */
export const getPortfolioAmitStatements = query(z.string(), async (portfolioId: string) => {
	const user = await getCurrentUser();
	if (!user) error(401, 'Unauthorized');

	const portfolio = await db.query.portfolioTable.findFirst({
		where: (p, { eq: e }) => e(p.id, portfolioId),
		with: { holdings: { with: { investment: true } } }
	});

	if (!portfolio) error(404, 'Portfolio not found');
	if (portfolio.userId !== user.id) error(403, 'Forbidden');

	const holdingIds = new Set(portfolio.holdings.map((h) => h.id));
	const all = await db.query.amitStatementTable.findMany({
		orderBy: (s, { desc }) => [desc(s.financialYear)]
	});

	return all
		.filter((s) => holdingIds.has(s.holdingId))
		.map((s) => {
			const holding = portfolio.holdings.find((h) => h.id === s.holdingId)!;
			return { ...s, holdingName: holding.investment.name, holdingCode: holding.investment.code };
		});
});

export const saveAmitStatement = form(amitStatementSchema, async (data) => {
	await assertOwnsHolding(data.holdingId);

	const values = {
		holdingId: data.holdingId,
		financialYear: data.financialYear,
		...amountsToCents(data as unknown as Record<string, unknown>)
	};

	// One statement per holding per year — re-saving a year replaces it.
	await db
		.insert(amitStatementTable)
		.values(values)
		.onConflictDoUpdate({
			target: [amitStatementTable.holdingId, amitStatementTable.financialYear],
			set: { ...values, updatedAt: new Date() }
		});

	return { success: true };
});
