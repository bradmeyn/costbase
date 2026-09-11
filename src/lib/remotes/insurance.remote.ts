import { command, form, query } from '$app/server';
import { z } from 'zod';
import { getCurrentUser } from '#lib/remotes/auth.remote.js';
import { db } from '$db';
import { insuranceTable } from '$db/schemas/budget';
import { eq } from 'drizzle-orm';
import { error } from '@sveltejs/kit';
import { insuranceSchema, updateInsuranceSchema } from '#lib/schemas/insurance.js';

export const getInsurances = query(async () => {
	const user = await getCurrentUser();
	if (!user) error(401, 'Unauthorized');
	return db.query.insuranceTable.findMany({
		where: eq(insuranceTable.userId, user.id),
		orderBy: (t, { asc }) => asc(t.renewalDate)
	});
});

export const addInsurance = form(insuranceSchema, async (data) => {
	const user = await getCurrentUser();
	if (!user) error(401, 'Unauthorized');
	await db.insert(insuranceTable).values({
		userId: user.id,
		name: data.name,
		provider: data.provider,
		category: data.category,
		premium: Math.round(data.premium * 100),
		frequency: data.frequency,
		renewalDate: new Date(data.renewalDate),
		owner: data.owner
	});
	await getInsurances().refresh();
	return { success: true };
});

export const updateInsurance = form(updateInsuranceSchema, async (data) => {
	const user = await getCurrentUser();
	if (!user) error(401, 'Unauthorized');
	const insurance = await db.query.insuranceTable.findFirst({
		where: eq(insuranceTable.id, data.id)
	});
	if (!insurance) error(404, 'Insurance not found');
	if (insurance.userId !== user.id) error(403, 'Forbidden');
	await db
		.update(insuranceTable)
		.set({
			name: data.name,
			provider: data.provider,
			category: data.category,
			premium: Math.round(data.premium * 100),
			frequency: data.frequency,
			renewalDate: new Date(data.renewalDate),
			owner: data.owner
		})
		.where(eq(insuranceTable.id, data.id));
	await getInsurances().refresh();
	return { success: true };
});

export const deleteInsurance = command(z.object({ id: z.string() }), async ({ id }) => {
	const user = await getCurrentUser();
	if (!user) error(401, 'Unauthorized');
	const insurance = await db.query.insuranceTable.findFirst({
		where: eq(insuranceTable.id, id)
	});
	if (!insurance) error(404, 'Insurance not found');
	if (insurance.userId !== user.id) error(403, 'Forbidden');
	await db.delete(insuranceTable).where(eq(insuranceTable.id, id));
	await getInsurances().refresh();
	return { success: true };
});
