import { query } from '$app/server';
import { getCurrentUser } from '#lib/remotes/auth.remote.js';
import { db } from '$db';
import { error } from '@sveltejs/kit';

export const getInvestments = query(async () => {
	const user = await getCurrentUser();
	if (!user) error(401, 'Unauthorized');

	const investments = await db.query.investmentTable.findMany({
		orderBy: (investments, { asc }) => [asc(investments.name)]
	});

	return investments;
});
