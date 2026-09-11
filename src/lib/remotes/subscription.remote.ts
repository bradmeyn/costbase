import { command, form, query } from '$app/server';
import { z } from 'zod';
import { getCurrentUser } from '#lib/remotes/auth.remote.js';
import { db } from '$db';
import { subscriptionTable } from '$db/schemas/budget';
import { and, eq, lte, gte } from 'drizzle-orm';
import { error } from '@sveltejs/kit';
import { FREQUENCY_ENUM, type FrequencyType } from '#lib/constants/frequencies.js';

export const getSubscriptions = query(async () => {
	const user = await getCurrentUser();
	if (!user) error(401, 'Unauthorized');
	return db.query.subscriptionTable.findMany({
		where: and(eq(subscriptionTable.userId, user.id), eq(subscriptionTable.active, true)),
		orderBy: (t, { asc }) => asc(t.nextDueDate)
	});
});

export const getUpcomingSubscriptions = query(async () => {
	const user = await getCurrentUser();
	if (!user) error(401, 'Unauthorized');
	const now = new Date();
	const in30Days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
	return db.query.subscriptionTable.findMany({
		where: and(
			eq(subscriptionTable.userId, user.id),
			eq(subscriptionTable.active, true),
			lte(subscriptionTable.nextDueDate, in30Days),
			gte(subscriptionTable.nextDueDate, now)
		),
		orderBy: (t, { asc }) => asc(t.nextDueDate)
	});
});

export const addSubscription = form(
	z.object({
		name: z.string().min(1, 'Name is required'),
		amount: z
			.string()
			.min(1, 'Amount is required')
			.transform((s) => parseFloat(s))
			.refine((n) => !Number.isNaN(n) && n > 0, 'Amount must be positive'),
		frequency: z.enum(FREQUENCY_ENUM as [FrequencyType, ...FrequencyType[]]),
		nextDueDate: z.string().min(1, 'Due date is required'),
		category: z.string(),
		owner: z.string().min(1, 'Owner is required')
	}),
	async (data) => {
		const user = await getCurrentUser();
		if (!user) error(401, 'Unauthorized');
		await db.insert(subscriptionTable).values({
			userId: user.id,
			name: data.name,
			amount: Math.round(data.amount * 100),
			frequency: data.frequency,
			nextDueDate: new Date(data.nextDueDate),
			category: data.category || null,
			owner: data.owner
		});
		await getSubscriptions().refresh();
		return { success: true };
	}
);

export const updateSubscription = form(
	z.object({
		id: z.string(),
		name: z.string().min(1, 'Name is required'),
		amount: z
			.string()
			.min(1, 'Amount is required')
			.transform((s) => parseFloat(s))
			.refine((n) => !Number.isNaN(n) && n > 0, 'Amount must be positive'),
		frequency: z.enum(FREQUENCY_ENUM as [FrequencyType, ...FrequencyType[]]),
		nextDueDate: z.string().min(1, 'Due date is required'),
		category: z.string(),
		owner: z.string().min(1, 'Owner is required')
	}),
	async (data) => {
		const user = await getCurrentUser();
		if (!user) error(401, 'Unauthorized');
		const sub = await db.query.subscriptionTable.findFirst({
			where: eq(subscriptionTable.id, data.id)
		});
		if (!sub) error(404, 'Subscription not found');
		if (sub.userId !== user.id) error(403, 'Forbidden');
		await db
			.update(subscriptionTable)
			.set({
				name: data.name,
				amount: Math.round(data.amount * 100),
				frequency: data.frequency,
				nextDueDate: new Date(data.nextDueDate),
				category: data.category || null,
				owner: data.owner
			})
			.where(eq(subscriptionTable.id, data.id));
		await getSubscriptions().refresh();
		return { success: true };
	}
);

export const deleteSubscription = command(z.object({ id: z.string() }), async ({ id }) => {
	const user = await getCurrentUser();
	if (!user) error(401, 'Unauthorized');
	const sub = await db.query.subscriptionTable.findFirst({
		where: eq(subscriptionTable.id, id)
	});
	if (!sub) error(404, 'Subscription not found');
	if (sub.userId !== user.id) error(403, 'Forbidden');
	await db.delete(subscriptionTable).where(eq(subscriptionTable.id, id));
	await getSubscriptions().refresh();
	return { success: true };
});
