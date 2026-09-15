import { command, form, query } from '$app/server';
import { z } from 'zod';
import { getCurrentUser } from '#lib/remotes/auth.remote.js';
import { db } from '$db';
import { holdingTable, portfolioTable } from '$db/schemas/portfolio';
import { getPortfolio } from '#lib/remotes/portfolio.remote.js';
import { eq } from 'drizzle-orm';
import { error } from '@sveltejs/kit';
import type {
	Holding,
	Investment,
	Transaction,
	Distribution,
	Document
} from '$db/schemas/portfolio';
import { getStockPrice } from '#lib/server/prices.js';
import {
	calculateHoldingMetrics,
	calculateUnrealisedMetrics
} from '#lib/utils/holding-calculations.js';
import { holdingSchema, updateHoldingSchema } from '#lib/schemas/portfolio.js';

interface HoldingWithBasicMetrics extends Holding {
	units: number;
	averagePrice: number;
	name: string;
	code: string;
	investment: Investment;
	transactions: Transaction[];
}

interface HoldingWithMetrics extends Holding {
	units: number;
	averagePrice: number;
	costBase: number;
	currentPrice: number;
	currentValue: number;
	unrealisedGain: number;
	unrealisedGainPercent: number;
	name: string;
	code: string;
	investment: Investment;
	transactions: (Transaction & { documents: Document[] })[];
	distributions: (Distribution & { documents: Document[] })[];
}

export const getHoldings = query(z.string(), async (portfolioId: string) => {
	const user = await getCurrentUser();
	if (!user) error(401, 'Unauthorized');

	// Verify user owns the portfolio
	const portfolio = await db.query.portfolioTable.findFirst({
		where: eq(portfolioTable.id, portfolioId)
	});

	if (!portfolio) error(404, 'Portfolio not found');
	if (portfolio.userId !== user.id) error(403, 'Forbidden');

	const holdings = await db.query.holdingTable.findMany({
		where: eq(holdingTable.portfolioId, portfolioId),
		with: {
			investment: true,
			transactions: true
		}
	});

	// Add calculated units and averagePrice to each holding
	return holdings.map((holding): HoldingWithBasicMetrics => {
		const { units, averagePrice } = calculateHoldingMetrics(holding.transactions);
		return {
			...holding,
			units,
			averagePrice,
			name: holding.investment.name,
			code: holding.investment.code
		};
	});
});

export const getHolding = query(z.string(), async (id: string) => {
	const user = await getCurrentUser();
	if (!user) error(401, 'Unauthorized');

	const holding = await db.query.holdingTable.findFirst({
		where: eq(holdingTable.id, id),
		with: {
			portfolio: true,
			investment: true,
			transactions: { with: { documents: true } },
			distributions: { with: { documents: true } }
		}
	});

	if (!holding) error(404, 'Holding not found');
	if (holding.portfolio.userId !== user.id) error(403, 'Forbidden');

	const { averagePrice } = calculateHoldingMetrics(holding.transactions);
	const currentPrice = (await getStockPrice(holding.investment.code)) ?? averagePrice;

	const metrics = calculateUnrealisedMetrics(holding.transactions, currentPrice);

	return {
		...holding,
		...metrics,
		name: holding.investment.name,
		code: holding.investment.code
	} as HoldingWithMetrics;
});

export const addHolding = form(holdingSchema, async ({ portfolioId, investmentId }) => {
	const user = await getCurrentUser();
	if (!user) error(401, 'Unauthorized');

	// Verify user owns the portfolio
	const portfolio = await db.query.portfolioTable.findFirst({
		where: eq(portfolioTable.id, portfolioId)
	});

	if (!portfolio) error(404, 'Portfolio not found');
	if (portfolio.userId !== user.id) error(403, 'Forbidden');

	const [newHolding] = await db
		.insert(holdingTable)
		.values({
			portfolioId,
			investmentId
		})
		.returning();

	// Refreshed here so the form's own `.updates()` are satisfied in one round trip.
	await Promise.all([getHoldings(portfolioId).refresh(), getPortfolio(portfolioId).refresh()]);

	return { success: true, holding: newHolding };
});

export const updateHolding = form(updateHoldingSchema, async ({ id, investmentId }) => {
	const user = await getCurrentUser();
	if (!user) error(401, 'Unauthorized');

	const holding = await db.query.holdingTable.findFirst({
		where: eq(holdingTable.id, id),
		with: {
			portfolio: true
		}
	});

	if (!holding) error(404, 'Holding not found');
	if (holding.portfolio.userId !== user.id) error(403, 'Forbidden');

	const [updatedHolding] = await db
		.update(holdingTable)
		.set({ investmentId })
		.where(eq(holdingTable.id, id))
		.returning();

	await Promise.all([
		getHolding(id).refresh(),
		getHoldings(holding.portfolioId).refresh(),
		getPortfolio(holding.portfolioId).refresh()
	]);

	return { success: true, holding: updatedHolding };
});

export const deleteHolding = command(
	z.object({
		id: z.string()
	}),
	async ({ id }) => {
		const user = await getCurrentUser();
		if (!user) error(401, 'Unauthorized');

		const holding = await db.query.holdingTable.findFirst({
			where: eq(holdingTable.id, id),
			with: {
				portfolio: true
			}
		});

		if (!holding) error(404, 'Holding not found');
		if (holding.portfolio.userId !== user.id) error(403, 'Forbidden');

		await db.delete(holdingTable).where(eq(holdingTable.id, id));

		await getHoldings(holding.portfolioId).refresh();

		return { success: true };
	}
);
