import { command, form, query } from '$app/server';
import { z } from 'zod';
import { getCurrentUser } from '#lib/remotes/auth.remote.js';
import { db } from '$db';
import { budgetItemTable } from '$db/schemas/budget';
import { eq } from 'drizzle-orm';
import { error } from '@sveltejs/kit';
import { FREQUENCY_ENUM, type FrequencyType } from '#lib/constants/frequencies.js';

const itemSchema = z.object({
	type: z.enum(['income', 'expense']),
	name: z.string().min(1, 'Name is required'),
	amount: z
		.string()
		.min(1, 'Amount is required')
		.transform((s) => parseFloat(s))
		.refine((n) => !Number.isNaN(n) && n > 0, 'Amount must be positive'),
	frequency: z.enum(FREQUENCY_ENUM as [FrequencyType, ...FrequencyType[]]),
	category: z.string().min(1, 'Category is required'),
	owner: z.string().min(1, 'Owner is required')
});

export const getBudgetItems = query(async () => {
	const user = await getCurrentUser();
	if (!user) error(401, 'Unauthorized');
	return db.query.budgetItemTable.findMany({
		where: eq(budgetItemTable.userId, user.id),
		orderBy: (t, { desc }) => desc(t.amount)
	});
});

export const addBudgetItem = form(itemSchema, async (data) => {
	const user = await getCurrentUser();
	if (!user) error(401, 'Unauthorized');
	await db.insert(budgetItemTable).values({
		userId: user.id,
		type: data.type,
		name: data.name,
		amount: Math.round(data.amount * 100),
		frequency: data.frequency,
		category: data.category,
		owner: data.owner
	});
	await getBudgetItems().refresh();
	return { success: true };
});

export const updateBudgetItem = form(itemSchema.extend({ id: z.string() }), async (data) => {
	const user = await getCurrentUser();
	if (!user) error(401, 'Unauthorized');
	const item = await db.query.budgetItemTable.findFirst({
		where: eq(budgetItemTable.id, data.id)
	});
	if (!item) error(404, 'Budget item not found');
	if (item.userId !== user.id) error(403, 'Forbidden');
	await db
		.update(budgetItemTable)
		.set({
			type: data.type,
			name: data.name,
			amount: Math.round(data.amount * 100),
			frequency: data.frequency,
			category: data.category,
			owner: data.owner
		})
		.where(eq(budgetItemTable.id, data.id));
	await getBudgetItems().refresh();
	return { success: true };
});

export const deleteBudgetItem = command(z.object({ id: z.string() }), async ({ id }) => {
	const user = await getCurrentUser();
	if (!user) error(401, 'Unauthorized');
	const item = await db.query.budgetItemTable.findFirst({
		where: eq(budgetItemTable.id, id)
	});
	if (!item) error(404, 'Budget item not found');
	if (item.userId !== user.id) error(403, 'Forbidden');
	await db.delete(budgetItemTable).where(eq(budgetItemTable.id, id));
	await getBudgetItems().refresh();
	return { success: true };
});
