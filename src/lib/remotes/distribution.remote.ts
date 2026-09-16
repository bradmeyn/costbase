import { command, form, query } from '$app/server';
import { z } from 'zod';
import { getCurrentUser } from '#lib/remotes/auth.remote.js';
import { db } from '$db';
import { distributionTable, holdingTable } from '$db/schemas/portfolio';
import { eq } from 'drizzle-orm';
import { error } from '@sveltejs/kit';
import { getHolding } from './holding.remote';
import { distributionSchema, updateDistributionSchema } from '#lib/schemas/portfolio.js';

export const getDistributions = query(z.string(), async (holdingId: string) => {
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

	const distributions = await db.query.distributionTable.findMany({
		where: eq(distributionTable.holdingId, holdingId),
		orderBy: (distributions, { desc }) => [desc(distributions.datePaid)]
	});

	return distributions;
});

export const getDistribution = query(z.string(), async (id: string) => {
	const user = await getCurrentUser();
	if (!user) error(401, 'Unauthorized');

	const distribution = await db.query.distributionTable.findFirst({
		where: eq(distributionTable.id, id),
		with: {
			holding: {
				with: {
					portfolio: true
				}
			}
		}
	});

	if (!distribution) error(404, 'Distribution not found');
	if (distribution.holding.portfolio.userId !== user.id) error(403, 'Forbidden');

	return distribution;
});

export const addDistribution = form(
	distributionSchema,
	async ({ holdingId, datePaid, grossPayment, taxWithheld, reinvested }) => {
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

		// Convert amounts to cents
		const [newDistribution] = await db
			.insert(distributionTable)
			.values({
				holdingId,
				datePaid: new Date(datePaid),
				grossPayment: Math.round(grossPayment * 100),
				taxWithheld: Math.round(taxWithheld * 100),
				reinvested
			})
			.returning();

		// Refresh holding data
		await getHolding(holdingId).refresh();

		return { success: true, distribution: newDistribution };
	}
);

export const updateDistribution = form(
	updateDistributionSchema,
	async ({ id, datePaid, grossPayment, taxWithheld, reinvested }) => {
		const user = await getCurrentUser();
		if (!user) error(401, 'Unauthorized');

		const distribution = await db.query.distributionTable.findFirst({
			where: eq(distributionTable.id, id),
			with: {
				holding: {
					with: {
						portfolio: true
					}
				}
			}
		});

		if (!distribution) error(404, 'Distribution not found');
		if (distribution.holding.portfolio.userId !== user.id) error(403, 'Forbidden');

		const [updatedDistribution] = await db
			.update(distributionTable)
			.set({
				datePaid: new Date(datePaid),
				grossPayment: Math.round(grossPayment * 100),
				taxWithheld: Math.round(taxWithheld * 100),
				reinvested
			})
			.where(eq(distributionTable.id, id))
			.returning();

		// Refresh holding data
		await getHolding(distribution.holdingId).refresh();

		return { success: true, distribution: updatedDistribution };
	}
);

export const deleteDistribution = command(
	z.object({
		id: z.string()
	}),
	async ({ id }) => {
		const user = await getCurrentUser();
		if (!user) error(401, 'Unauthorized');

		const distribution = await db.query.distributionTable.findFirst({
			where: eq(distributionTable.id, id),
			with: {
				holding: {
					with: {
						portfolio: true
					}
				}
			}
		});

		if (!distribution) error(404, 'Distribution not found');
		if (distribution.holding.portfolio.userId !== user.id) error(403, 'Forbidden');

		await db.delete(distributionTable).where(eq(distributionTable.id, id));

		// Refresh holding data
		await getHolding(distribution.holdingId).refresh();

		return { success: true };
	}
);
