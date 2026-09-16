import { eq } from 'drizzle-orm';
import { error } from '@sveltejs/kit';
import { db } from '$db';
import { portfolioTable } from '$db/schemas/portfolio';
import {
	annualStatementDocumentName,
	distributionDocumentName,
	taxStatementDocumentName,
	transactionDocumentName
} from '#lib/utils/document-names.js';
import { distributionEntitlementDate, isoDay } from '#lib/report-period.js';
import { financialYearEnd } from '#lib/utils/amit-calculations.js';
import type { DocumentKind, PortfolioDocument } from '#lib/documents-filter.js';

/*
  Every document in a portfolio, flattened into one list with the name it should be
  known by. Read from the owning rows rather than the document table so each file
  arrives with the trade or statement that gives it a name and a date.
*/
export async function loadPortfolioDocuments(
	portfolioId: string,
	userId: string
): Promise<PortfolioDocument[]> {
	const portfolio = await db.query.portfolioTable.findFirst({
		where: eq(portfolioTable.id, portfolioId),
		with: {
			holdings: {
				with: {
					investment: true,
					transactions: { with: { documents: true } },
					distributions: { with: { documents: true } },
					amitStatements: { with: { documents: true } },
					annualStatements: { with: { documents: true } }
				}
			}
		}
	});
	if (!portfolio) error(404, 'Portfolio not found');
	if (portfolio.userId !== userId) error(403, 'Forbidden');

	const found: PortfolioDocument[] = [];

	for (const holding of portfolio.holdings) {
		const code = holding.investment.code;
		const add = (
			kind: DocumentKind,
			name: string,
			dated: Date,
			asAt: Date,
			financialYear: number | null,
			documents: { id: string; filename: string; sizeBytes: number; path: string }[]
		) => {
			for (const document of documents) {
				found.push({
					id: document.id,
					kind,
					code,
					name,
					filename: document.filename,
					sizeBytes: document.sizeBytes,
					path: document.path,
					dated: isoDay(dated),
					asAt: isoDay(asAt),
					financialYear
				});
			}
		};

		for (const t of holding.transactions) {
			const at = new Date(t.transactionDate);
			add('transaction', transactionDocumentName({ ...t, code }), at, at, null, t.documents);
		}
		for (const d of holding.distributions) {
			add(
				'distribution',
				distributionDocumentName({ ...d, code }),
				new Date(d.datePaid),
				distributionEntitlementDate(d),
				null,
				d.documents
			);
		}
		for (const s of holding.amitStatements) {
			const at = financialYearEnd(s.financialYear);
			add(
				'amitStatement',
				taxStatementDocumentName({ ...s, code }),
				at,
				at,
				s.financialYear,
				s.documents
			);
		}
		for (const s of holding.annualStatements) {
			const at = financialYearEnd(s.financialYear);
			add(
				'annualStatement',
				annualStatementDocumentName({ ...s, code }),
				at,
				at,
				s.financialYear,
				s.documents
			);
		}
	}

	// Newest first by the date on the document, so the list reads like the filenames.
	return found.sort((a, b) => b.dated.localeCompare(a.dated) || a.name.localeCompare(b.name));
}
