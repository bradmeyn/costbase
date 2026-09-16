import { query } from '$app/server';
import { z } from 'zod';
import { error } from '@sveltejs/kit';
import { getCurrentUser } from '#lib/remotes/auth.remote.js';
import { loadPortfolioDocuments } from '#lib/server/portfolio-documents.js';

/** Every source document in a portfolio, named and dated, newest first. */
export const getPortfolioDocuments = query(z.string(), async (portfolioId: string) => {
	const user = await getCurrentUser();
	if (!user) error(401, 'Unauthorized');
	return loadPortfolioDocuments(portfolioId, user.id);
});
