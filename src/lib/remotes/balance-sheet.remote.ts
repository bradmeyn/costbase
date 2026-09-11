import { command, form, query } from '$app/server';
import { z } from 'zod';
import { getCurrentUser } from '#lib/remotes/auth.remote.js';
import { db } from '$db';
import { assetTable, liabilityTable } from '$db/schemas/budget';
import { eq } from 'drizzle-orm';
import { error } from '@sveltejs/kit';
import {
	assetSchema,
	updateAssetSchema,
	liabilitySchema,
	updateLiabilitySchema
} from '#lib/schemas/balance-sheet.js';

export const getAssets = query(async () => {
	const user = await getCurrentUser();
	if (!user) error(401, 'Unauthorized');
	return db.query.assetTable.findMany({
		where: eq(assetTable.userId, user.id),
		orderBy: (t, { asc }) => asc(t.category)
	});
});

export const getLiabilities = query(async () => {
	const user = await getCurrentUser();
	if (!user) error(401, 'Unauthorized');
	return db.query.liabilityTable.findMany({
		where: eq(liabilityTable.userId, user.id),
		orderBy: (t, { asc }) => asc(t.category)
	});
});

export const addAsset = form(assetSchema, async (data) => {
	const user = await getCurrentUser();
	if (!user) error(401, 'Unauthorized');
	await db.insert(assetTable).values({
		userId: user.id,
		name: data.name,
		value: Math.round(data.amount * 100),
		category: data.category,
		owner: data.owner,
		notes: null
	});
	await getAssets().refresh();
	return { success: true };
});

export const updateAsset = form(updateAssetSchema, async (data) => {
	const user = await getCurrentUser();
	if (!user) error(401, 'Unauthorized');
	const asset = await db.query.assetTable.findFirst({ where: eq(assetTable.id, data.id) });
	if (!asset) error(404, 'Asset not found');
	if (asset.userId !== user.id) error(403, 'Forbidden');
	await db
		.update(assetTable)
		.set({
			name: data.name,
			value: Math.round(data.amount * 100),
			category: data.category,
			owner: data.owner || null
		})
		.where(eq(assetTable.id, data.id));
	await getAssets().refresh();
	return { success: true };
});

export const deleteAsset = command(z.object({ id: z.string() }), async ({ id }) => {
	const user = await getCurrentUser();
	if (!user) error(401, 'Unauthorized');
	const asset = await db.query.assetTable.findFirst({ where: eq(assetTable.id, id) });
	if (!asset) error(404, 'Asset not found');
	if (asset.userId !== user.id) error(403, 'Forbidden');
	await db.delete(assetTable).where(eq(assetTable.id, id));
	await getAssets().refresh();
	return { success: true };
});

export const addLiability = form(liabilitySchema, async (data) => {
	const user = await getCurrentUser();
	if (!user) error(401, 'Unauthorized');
	await db.insert(liabilityTable).values({
		userId: user.id,
		name: data.name,
		balance: Math.round(data.balance * 100),
		interestRate: Math.round(data.interestRate * 100),
		category: data.category,
		owner: data.owner,
		notes: null
	});
	await getLiabilities().refresh();
	return { success: true };
});

export const updateLiability = form(updateLiabilitySchema, async (data) => {
	const user = await getCurrentUser();
	if (!user) error(401, 'Unauthorized');
	const liability = await db.query.liabilityTable.findFirst({
		where: eq(liabilityTable.id, data.id)
	});
	if (!liability) error(404, 'Liability not found');
	if (liability.userId !== user.id) error(403, 'Forbidden');
	await db
		.update(liabilityTable)
		.set({
			name: data.name,
			balance: Math.round(data.balance * 100),
			interestRate: Math.round(data.interestRate * 100),
			category: data.category,
			owner: data.owner || null
		})
		.where(eq(liabilityTable.id, data.id));
	await getLiabilities().refresh();
	return { success: true };
});

export const deleteLiability = command(z.object({ id: z.string() }), async ({ id }) => {
	const user = await getCurrentUser();
	if (!user) error(401, 'Unauthorized');
	const liability = await db.query.liabilityTable.findFirst({ where: eq(liabilityTable.id, id) });
	if (!liability) error(404, 'Liability not found');
	if (liability.userId !== user.id) error(403, 'Forbidden');
	await db.delete(liabilityTable).where(eq(liabilityTable.id, id));
	await getLiabilities().refresh();
	return { success: true };
});
