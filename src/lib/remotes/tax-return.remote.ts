import { command, query } from '$app/server';
import { z } from 'zod';
import { and, eq } from 'drizzle-orm';
import { error } from '@sveltejs/kit';
import { db } from '$db';
import { capitalLossCarryforwardTable, portfolioTable } from '$db/schemas/portfolio';
import { getCurrentUser } from '#lib/remotes/auth.remote.js';

async function ownedPortfolio(portfolioId: string) {
	const user = await getCurrentUser();
	if (!user) error(401, 'Unauthorized');

	const portfolio = await db.query.portfolioTable.findFirst({
		where: eq(portfolioTable.id, portfolioId)
	});
	if (!portfolio) error(404, 'Portfolio not found');
	if (portfolio.userId !== user.id) error(403, 'Forbidden');
	return portfolio;
}

/**
 * Net capital losses carried into a financial year, in cents. Zero when none has
 * been recorded — which is not the same as knowing there were none.
 */
export const getCarriedForwardLoss = query(
	z.object({ portfolioId: z.string().min(1), financialYear: z.number().int() }),
	async ({ portfolioId, financialYear }) => {
		await ownedPortfolio(portfolioId);

		const row = await db.query.capitalLossCarryforwardTable.findFirst({
			where: and(
				eq(capitalLossCarryforwardTable.portfolioId, portfolioId),
				eq(capitalLossCarryforwardTable.financialYear, financialYear)
			)
		});

		return { amount: row?.amount ?? 0, recorded: !!row };
	}
);

/** Record what last year's return said was carried forward. */
export const setCarriedForwardLoss = command(
	z.object({
		portfolioId: z.string().min(1),
		financialYear: z.number().int(),
		/** Cents, as a positive magnitude. */
		amount: z.number().int().nonnegative()
	}),
	async ({ portfolioId, financialYear, amount }) => {
		await ownedPortfolio(portfolioId);

		await db
			.insert(capitalLossCarryforwardTable)
			.values({ portfolioId, financialYear, amount })
			.onConflictDoUpdate({
				target: [
					capitalLossCarryforwardTable.portfolioId,
					capitalLossCarryforwardTable.financialYear
				],
				set: { amount, updatedAt: new Date() }
			});

		await getCarriedForwardLoss({ portfolioId, financialYear }).refresh();

		return { success: true };
	}
);
