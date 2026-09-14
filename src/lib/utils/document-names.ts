/*
  Names a document by what it is, not by whatever the broker called the file.

  The shape follows the convention the files are kept in:
    2026_03_02_buy_vgs_6_units_stake.pdf
    2026_06_30_distribution_vas.pdf
    fy_25_26_tax_statement_vgs.pdf

  Sortable by date, readable without opening, and identical whether the file came
  from Stake, SelfWealth or a hand-entered row.
*/

const slug = (value: string) =>
	value
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '_')
		.replace(/^_+|_+$/g, '');

/** Local calendar date as yyyy_mm_dd — never the UTC one. */
function dateParts(date: Date | string): string {
	const d = new Date(date);
	return [
		d.getFullYear(),
		String(d.getMonth() + 1).padStart(2, '0'),
		String(d.getDate()).padStart(2, '0')
	].join('_');
}

export function transactionDocumentName(transaction: {
	transactionDate: Date | string;
	type: string;
	quantity: number;
	platform?: string | null;
	code: string;
}): string {
	const parts = [
		dateParts(transaction.transactionDate),
		slug(transaction.type),
		slug(transaction.code),
		String(transaction.quantity),
		'units'
	];
	if (transaction.platform) parts.push(slug(transaction.platform));
	return `${parts.join('_')}.pdf`;
}

export function distributionDocumentName(distribution: {
	datePaid: Date | string;
	reinvested: boolean;
	code: string;
}): string {
	return [
		dateParts(distribution.datePaid),
		distribution.reinvested ? 'reinvestment' : 'distribution',
		slug(distribution.code)
	]
		.join('_')
		.concat('.pdf');
}

/** "fy_25_26_tax_statement_vgs.pdf" for the year ending in 2026. */
export function taxStatementDocumentName(statement: {
	financialYear: number;
	code: string;
}): string {
	const start = String((statement.financialYear - 1) % 100).padStart(2, '0');
	const end = String(statement.financialYear % 100).padStart(2, '0');
	return `fy_${start}_${end}_tax_statement_${slug(statement.code)}.pdf`;
}
