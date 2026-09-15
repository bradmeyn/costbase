import { query } from '$app/server';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { error } from '@sveltejs/kit';
import { db } from '$db';
import { holdingTable, portfolioTable } from '$db/schemas/portfolio';
import { getCurrentUser } from '#lib/remotes/auth.remote.js';

async function assertOwnsHolding(holdingId: string) {
	const user = await getCurrentUser();
	if (!user) error(401, 'Unauthorized');

	const holding = await db.query.holdingTable.findFirst({
		where: eq(holdingTable.id, holdingId),
		with: { portfolio: true }
	});
	if (!holding) error(404, 'Holding not found');
	if (holding.portfolio.userId !== user.id) error(403, 'Forbidden');
	return holding;
}

/** The registry's annual statements for a holding, newest first. */
export const getAnnualStatements = query(z.string(), async (holdingId: string) => {
	await assertOwnsHolding(holdingId);

	return db.query.annualStatementTable.findMany({
		where: (a, { eq: e }) => e(a.holdingId, holdingId),
		with: { documents: true },
		orderBy: (a, { desc }) => [desc(a.financialYear), desc(a.holderNumber)]
	});
});

/** Every annual statement across a portfolio, for reconciling a year at a time. */
export const getPortfolioAnnualStatements = query(z.string(), async (portfolioId: string) => {
	const user = await getCurrentUser();
	if (!user) error(401, 'Unauthorized');

	const portfolio = await db.query.portfolioTable.findFirst({
		where: eq(portfolioTable.id, portfolioId),
		with: { holdings: { with: { investment: true } } }
	});
	if (!portfolio) error(404, 'Portfolio not found');
	if (portfolio.userId !== user.id) error(403, 'Forbidden');

	const byHolding = new Map(portfolio.holdings.map((h) => [h.id, h.investment.code]));
	const statements = await db.query.annualStatementTable.findMany({
		where: (a, { inArray }) => inArray(a.holdingId, [...byHolding.keys()]),
		orderBy: (a, { desc }) => [desc(a.financialYear)]
	});

	return statements.map((s) => ({ ...s, code: byHolding.get(s.holdingId) ?? '' }));
});
