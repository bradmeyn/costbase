import { z } from 'zod';

/**
 * AMMA statement entry. Every monetary field is a dollar amount as typed on the
 * statement; the remote converts to cents for storage.
 */
const dollars = z.number().finite().min(-1_000_000_000).max(1_000_000_000).default(0);

/** Field groups, in statement order, so the form can render straight down the page. */
export const AMIT_PART_A = [
	[
		'label13U',
		'13U',
		'Share of net income from trusts, less net capital gains, foreign income and franked distributions'
	],
	['label13C', '13C', 'Franked distributions from trusts'],
	['label13Q', '13Q', 'Share of franking credits from franked dividends'],
	['label13R', '13R', 'Share of credit for TFN amounts withheld'],
	['label13A', '13A', 'Share of credit for foreign resident withholding amounts'],
	['label18A', '18A', 'Net capital gain'],
	['label18H', '18H', 'Total current year capital gains'],
	['label20E', '20E', 'Assessable foreign source income'],
	['label20M', '20M', 'Other net foreign source income'],
	['label20O', '20O', 'Foreign income tax offset']
] as const satisfies readonly (readonly [string, string, string])[];

export const AMIT_AUSTRALIAN_INCOME = [
	['unfrankedDistributions', 'Unfranked distributions'],
	['unfrankedCfiDistributions', 'Unfranked CFI distributions'],
	['interestSubjectToNrwht', 'Interest — subject to non resident WHT'],
	['interestNotSubjectToNrwht', 'Interest — not subject to non resident WHT'],
	['otherIncomeCleanBuildingMit', 'Other income — clean building MIT income'],
	['otherIncomeExcludedFromNcmi', 'Other income — excluded from NCMI'],
	['otherIncomeNcmi', 'Other income — NCMI'],
	['otherIncome', 'Other income'],
	['nonPrimaryProductionIncome', 'Non primary production income']
] as const satisfies readonly (readonly [string, string])[];

export const AMIT_FRANKED = [
	['frankedDistributionsCash', 'Franked distributions — cash distribution'],
	['frankedDistributionsCredit', 'Franked distributions — tax paid/offsets'],
	['frankedDistributionsAttribution', 'Franked distributions — attribution']
] as const satisfies readonly (readonly [string, string])[];

export const AMIT_CAPITAL_GAINS = [
	['discountedTapCleanBuildingMit', 'Discounted capital gains TAP — clean building MIT income'],
	['discountedTapExcludedFromNcmi', 'Discounted capital gains TAP — excluded from NCMI'],
	['discountedTapNcmi', 'Discounted capital gains TAP — NCMI'],
	['discountedTap', 'Discounted capital gains TAP'],
	['discountedNtap', 'Discounted capital gains NTAP'],
	['otherMethodTapCleanBuildingMit', 'Capital gains other method TAP — clean building MIT income'],
	['otherMethodTapExcludedFromNcmi', 'Capital gains other method TAP — excluded from NCMI'],
	['otherMethodTapNcmi', 'Capital gains other method TAP — NCMI'],
	['otherMethodTap', 'Capital gains other method TAP'],
	['otherMethodNtap', 'Capital gains other method NTAP'],
	['netCapitalGain', 'Net capital gain'],
	['amitCgtGrossUpAmount', 'AMIT CGT gross up amount'],
	['totalCurrentYearCapitalGains', 'Total current year capital gains']
] as const satisfies readonly (readonly [string, string])[];

export const AMIT_RECONCILIATION = [
	['foreignIncomeTaxOffset', 'Foreign income tax offset (tax paid)'],
	['assessableForeignSourceIncome', 'Assessable foreign source income'],
	['nonAssessableNonExemptAmount', 'Non-assessable non-exempt amount'],
	['grossCashDistribution', 'Gross amount — cash distribution'],
	['grossAttribution', 'Gross amount — attribution'],
	['amitCostBaseExcess', 'AMIT cost base net amount — excess (reduce cost base)'],
	['amitCostBaseShortfall', 'AMIT cost base net amount — shortfall (increase cost base)'],
	['tfnAmountsWithheld', 'Less TFN amounts withheld'],
	['nrwhtInterestDividend', 'Less non-resident WHT — interest/dividend'],
	['nrwhtFundPayment', 'Less non-resident WHT — fund payment'],
	['netCashDistribution', 'Net cash distribution']
] as const satisfies readonly (readonly [string, string])[];

/** Every monetary field name, in statement order. */
export const AMIT_AMOUNT_FIELDS = [
	...AMIT_PART_A.map(([f]) => f),
	...AMIT_AUSTRALIAN_INCOME.map(([f]) => f),
	...AMIT_FRANKED.map(([f]) => f),
	...AMIT_CAPITAL_GAINS.map(([f]) => f),
	...AMIT_RECONCILIATION.map(([f]) => f)
] as const;

export type AmitAmountField = (typeof AMIT_AMOUNT_FIELDS)[number];

export const amitStatementSchema = z.object({
	holdingId: z.string().min(1, 'Holding is required'),
	/** The year the financial year ends in: 2026 = 1 Jul 2025 - 30 Jun 2026. */
	financialYear: z
		.number()
		.int()
		.min(2000, 'Financial year looks too early')
		.max(2100, 'Financial year looks too late'),

	// Written out explicitly rather than generated: SvelteKit's form() needs a
	// concrete ZodObject shape to infer the handler's `data` type.
	label13U: dollars,
	label13C: dollars,
	label13Q: dollars,
	label13R: dollars,
	label13A: dollars,
	label18A: dollars,
	label18H: dollars,
	label20E: dollars,
	label20M: dollars,
	label20O: dollars,
	unfrankedDistributions: dollars,
	unfrankedCfiDistributions: dollars,
	interestSubjectToNrwht: dollars,
	interestNotSubjectToNrwht: dollars,
	otherIncomeCleanBuildingMit: dollars,
	otherIncomeExcludedFromNcmi: dollars,
	otherIncomeNcmi: dollars,
	otherIncome: dollars,
	nonPrimaryProductionIncome: dollars,
	frankedDistributionsCash: dollars,
	frankedDistributionsCredit: dollars,
	frankedDistributionsAttribution: dollars,
	discountedTapCleanBuildingMit: dollars,
	discountedTapExcludedFromNcmi: dollars,
	discountedTapNcmi: dollars,
	discountedTap: dollars,
	discountedNtap: dollars,
	otherMethodTapCleanBuildingMit: dollars,
	otherMethodTapExcludedFromNcmi: dollars,
	otherMethodTapNcmi: dollars,
	otherMethodTap: dollars,
	otherMethodNtap: dollars,
	netCapitalGain: dollars,
	amitCgtGrossUpAmount: dollars,
	totalCurrentYearCapitalGains: dollars,
	foreignIncomeTaxOffset: dollars,
	assessableForeignSourceIncome: dollars,
	nonAssessableNonExemptAmount: dollars,
	grossCashDistribution: dollars,
	grossAttribution: dollars,
	amitCostBaseExcess: dollars,
	amitCostBaseShortfall: dollars,
	tfnAmountsWithheld: dollars,
	nrwhtInterestDividend: dollars,
	nrwhtFundPayment: dollars,
	netCashDistribution: dollars
});

export const updateAmitStatementSchema = amitStatementSchema.extend({
	id: z.string().min(1)
});

export type AmitStatementInput = z.infer<typeof amitStatementSchema>;
