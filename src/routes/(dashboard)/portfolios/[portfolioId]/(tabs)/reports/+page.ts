import { redirect } from '@sveltejs/kit';

/** /reports has no content of its own; land on the report you'll want most. */
export function load({ params, url }) {
	redirect(307, `/portfolios/${params.portfolioId}/reports/capital-gains${url.search}`);
}
