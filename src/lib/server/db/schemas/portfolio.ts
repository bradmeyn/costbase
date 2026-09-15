import { pgTable, text, timestamp, uuid, integer, boolean, unique } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { user } from './auth';

const timesStamps = {
	createdAt: timestamp('created_at').defaultNow().notNull(),
	updatedAt: timestamp('updated_at')
		.defaultNow()
		.notNull()
		.$onUpdate(() => new Date())
};

const userId = text('user_id')
	.notNull()
	.references(() => user.id, { onDelete: 'cascade' });

export const portfolioTable = pgTable('portfolio', {
	id: uuid('id').defaultRandom().primaryKey(),
	userId,
	name: text('name').notNull(),
	...timesStamps
});

export const holdingTable = pgTable('holding', {
	id: uuid('id').defaultRandom().primaryKey(),
	portfolioId: uuid('portfolio_id')
		.notNull()
		.references(() => portfolioTable.id, { onDelete: 'cascade' }),
	investmentId: uuid('investment_id')
		.notNull()
		.references(() => investmentTable.id, { onDelete: 'cascade' }),
	...timesStamps
});

export const transactionTable = pgTable('transaction', {
	id: uuid('id').defaultRandom().primaryKey(),
	holdingId: uuid('holding_id')
		.notNull()
		.references(() => holdingTable.id, { onDelete: 'cascade' }),
	quantity: integer('quantity').notNull(),
	pricePerUnit: integer('price_per_unit').notNull(),
	brokerage: integer('brokerage').notNull().default(0), // in cents
	/**
	 * Total consideration in cents, as stated on the contract note. Authoritative where
	 * present: broker prices carry four decimals and quantity * pricePerUnit does not
	 * reproduce the stated value. Null for hand-entered rows, which fall back to
	 * quantity * pricePerUnit.
	 */
	value: integer('value'),
	/**
	 * Broker's confirmation number, where the row came from a contract note. Unique so
	 * the same note cannot be imported twice.
	 */
	confirmationNumber: text('confirmation_number').unique(),
	/**
	 * Broker or platform the trade was placed through, e.g. "Stake". Set from the
	 * contract note on import. Carries no tax meaning — it is there so a parcel can be
	 * traced back to the account and the paperwork it came from.
	 */
	platform: text('platform'),
	transactionDate: timestamp('transaction_date').notNull(),
	type: text('type').notNull(), // 'buy', 'sell', or 'reinvestment'
	...timesStamps
});

export const investmentTable = pgTable('investment', {
	id: uuid('id').defaultRandom().primaryKey(),
	name: text('name').notNull(),
	code: text('code').notNull(),
	managementFee: integer('management_fee').notNull().default(0), // in basis points
	type: text('type').notNull(), // e.g., 'stock', 'bond', etc.
	...timesStamps
});

export const distributionTable = pgTable('distribution', {
	id: uuid('id').defaultRandom().primaryKey(),
	holdingId: uuid('holding_id')
		.notNull()
		.references(() => holdingTable.id, { onDelete: 'cascade' }),
	datePaid: timestamp('date_paid').notNull(),
	/** Record date — who is entitled. Distinct from the payment date. */
	recordDate: timestamp('record_date'),
	/** Units held at the record date, as stated. */
	units: integer('units'),
	/**
	 * Cash per security, in millionths of a cent. Distribution rates carry eight
	 * decimals (0.48829897), which cents cannot hold.
	 */
	centsPerUnit: integer('cents_per_unit'),
	// All amounts stored in cents
	grossPayment: integer('gross_payment').notNull().default(0),
	taxWithheld: integer('tax_withheld').notNull().default(0),
	// Reinvestment details
	reinvested: boolean('reinvested').notNull().default(false),
	...timesStamps
});

/*
  Net capital losses carried into a financial year from earlier ones.

  Held per year rather than as a single running balance because the app rarely has
  every year that produced them: the figure comes off last year's return, which is
  the only place it is authoritative.
*/
export const capitalLossCarryforwardTable = pgTable(
	'capital_loss_carryforward',
	{
		id: uuid('id').defaultRandom().primaryKey(),
		portfolioId: uuid('portfolio_id')
			.notNull()
			.references(() => portfolioTable.id, { onDelete: 'cascade' }),
		/** The year the losses are carried *into*: 2026 = 1 Jul 2025 - 30 Jun 2026. */
		financialYear: integer('financial_year').notNull(),
		/** Cents. Held as a positive magnitude. */
		amount: integer('amount').notNull().default(0),
		...timesStamps
	},
	(table) => [unique().on(table.portfolioId, table.financialYear)]
);

/*
  AMIT Member Annual Statement (AMMA) — one per holding per financial year.
  Mirrors the Vanguard/Computershare statement layout so the entry form can be
  filled straight down the page. All amounts in cents, matching the rest of the
  schema. `financialYear` is the year the FY ends in: 2026 = 1 Jul 2025 - 30 Jun 2026.
*/
export const amitStatementTable = pgTable(
	'amit_statement',
	{
		id: uuid('id').defaultRandom().primaryKey(),
		holdingId: uuid('holding_id')
			.notNull()
			.references(() => holdingTable.id, { onDelete: 'cascade' }),
		financialYear: integer('financial_year').notNull(),
		/**
		 * The holder number the statement was issued against, as printed. A holding can
		 * produce two statements in one year — moving broker moves the units to a new HIN
		 * and each registry issues its own — and both sets of figures go on the return.
		 */
		holderNumber: text('holder_number').notNull().default(''),

		// Part A — summary of tax return items
		label13U: integer('label_13u').notNull().default(0),
		label13C: integer('label_13c').notNull().default(0),
		label13Q: integer('label_13q').notNull().default(0),
		label13R: integer('label_13r').notNull().default(0),
		label13A: integer('label_13a').notNull().default(0),
		label18A: integer('label_18a').notNull().default(0),
		label18H: integer('label_18h').notNull().default(0),
		label20E: integer('label_20e').notNull().default(0),
		label20M: integer('label_20m').notNull().default(0),
		label20O: integer('label_20o').notNull().default(0),

		// Part B — Australian income
		unfrankedDistributions: integer('unfranked_distributions').notNull().default(0),
		unfrankedCfiDistributions: integer('unfranked_cfi_distributions').notNull().default(0),
		interestSubjectToNrwht: integer('interest_subject_to_nrwht').notNull().default(0),
		interestNotSubjectToNrwht: integer('interest_not_subject_to_nrwht').notNull().default(0),
		otherIncomeCleanBuildingMit: integer('other_income_clean_building_mit').notNull().default(0),
		otherIncomeExcludedFromNcmi: integer('other_income_excluded_from_ncmi').notNull().default(0),
		otherIncomeNcmi: integer('other_income_ncmi').notNull().default(0),
		otherIncome: integer('other_income').notNull().default(0),
		nonPrimaryProductionIncome: integer('non_primary_production_income').notNull().default(0),

		// Part B — franked distributions
		frankedDistributionsCash: integer('franked_distributions_cash').notNull().default(0),
		frankedDistributionsCredit: integer('franked_distributions_credit').notNull().default(0),
		frankedDistributionsAttribution: integer('franked_distributions_attribution')
			.notNull()
			.default(0),

		// Part B — capital gains
		discountedTapCleanBuildingMit: integer('discounted_tap_clean_building_mit')
			.notNull()
			.default(0),
		discountedTapExcludedFromNcmi: integer('discounted_tap_excluded_from_ncmi')
			.notNull()
			.default(0),
		discountedTapNcmi: integer('discounted_tap_ncmi').notNull().default(0),
		discountedTap: integer('discounted_tap').notNull().default(0),
		discountedNtap: integer('discounted_ntap').notNull().default(0),
		otherMethodTapCleanBuildingMit: integer('other_method_tap_clean_building_mit')
			.notNull()
			.default(0),
		otherMethodTapExcludedFromNcmi: integer('other_method_tap_excluded_from_ncmi')
			.notNull()
			.default(0),
		otherMethodTapNcmi: integer('other_method_tap_ncmi').notNull().default(0),
		otherMethodTap: integer('other_method_tap').notNull().default(0),
		otherMethodNtap: integer('other_method_ntap').notNull().default(0),
		netCapitalGain: integer('net_capital_gain').notNull().default(0),
		amitCgtGrossUpAmount: integer('amit_cgt_gross_up_amount').notNull().default(0),
		totalCurrentYearCapitalGains: integer('total_current_year_capital_gains').notNull().default(0),

		// Part B — foreign income
		foreignIncomeTaxOffset: integer('foreign_income_tax_offset').notNull().default(0),
		assessableForeignSourceIncome: integer('assessable_foreign_source_income').notNull().default(0),

		// Part B — other non-assessable amounts
		nonAssessableNonExemptAmount: integer('non_assessable_non_exempt_amount').notNull().default(0),

		// Part B — reconciliation
		grossCashDistribution: integer('gross_cash_distribution').notNull().default(0),
		grossAttribution: integer('gross_attribution').notNull().default(0),
		/** AMIT cost base net amount — excess. Reduces the cost base. */
		amitCostBaseExcess: integer('amit_cost_base_excess').notNull().default(0),
		/** AMIT cost base net amount — shortfall. Increases the cost base. */
		amitCostBaseShortfall: integer('amit_cost_base_shortfall').notNull().default(0),
		tfnAmountsWithheld: integer('tfn_amounts_withheld').notNull().default(0),
		nrwhtInterestDividend: integer('nrwht_interest_dividend').notNull().default(0),
		nrwhtFundPayment: integer('nrwht_fund_payment').notNull().default(0),
		netCashDistribution: integer('net_cash_distribution').notNull().default(0),

		...timesStamps
	},
	(t) => [
		unique('amit_statement_holding_year_holder').on(t.holdingId, t.financialYear, t.holderNumber)
	]
);

/*
  The registry's annual (MIS) statement for a holding. It carries no tax figures —
  the document says so itself — so nothing here reaches a return. It is kept as an
  independent record of what the registry counted: units at each year end, and the
  cash it actually paid, against which the app's own transactions and distributions
  can be checked.
*/
export const annualStatementTable = pgTable(
	'annual_statement',
	{
		id: uuid('id').defaultRandom().primaryKey(),
		holdingId: uuid('holding_id')
			.notNull()
			.references(() => holdingTable.id, { onDelete: 'cascade' }),
		/** The year the financial year ends in. */
		financialYear: integer('financial_year').notNull(),
		/** Last four digits of the holder number, as on the tax statement. */
		holderNumber: text('holder_number').notNull().default(''),
		/** The period's end, which is 30 June unless the holding closed mid-year. */
		periodEnd: timestamp('period_end').notNull(),
		openingUnits: integer('opening_units').notNull().default(0),
		closingUnits: integer('closing_units').notNull().default(0),
		/** Cents. */
		closingUnitPrice: integer('closing_unit_price').notNull().default(0),
		closingValue: integer('closing_value').notNull().default(0),
		cashDistributionReceived: integer('cash_distribution_received').notNull().default(0),
		/** Taken inside the fund, so not a cost base item. Informational. */
		totalFees: integer('total_fees').notNull().default(0),
		...timesStamps
	},
	(t) => [
		unique('annual_statement_holding_year_holder').on(t.holdingId, t.financialYear, t.holderNumber)
	]
);

/*
  An attached source document (contract note, distribution, AMMA or annual statement).

  A database check constraint, document_exactly_one_owner, enforces that exactly one
  owner column is set. It lives in the database rather than here, so adding an owner
  means widening it there too.
  Separate nullable foreign keys are used rather than a polymorphic
  entity_type/entity_id pair so that referential integrity and cascade deletes are
  enforced by the database.
*/
export const documentTable = pgTable('document', {
	id: uuid('id').defaultRandom().primaryKey(),
	transactionId: uuid('transaction_id').references(() => transactionTable.id, {
		onDelete: 'cascade'
	}),
	distributionId: uuid('distribution_id').references(() => distributionTable.id, {
		onDelete: 'cascade'
	}),
	amitStatementId: uuid('amit_statement_id').references(() => amitStatementTable.id, {
		onDelete: 'cascade'
	}),
	annualStatementId: uuid('annual_statement_id').references(() => annualStatementTable.id, {
		onDelete: 'cascade'
	}),
	/** Original filename as uploaded. */
	filename: text('filename').notNull(),
	/** Path relative to the configured document store root. */
	path: text('path').notNull(),
	sizeBytes: integer('size_bytes').notNull(),
	contentType: text('content_type').notNull().default('application/pdf'),
	...timesStamps
});

export const portfolioRelations = relations(portfolioTable, ({ many }) => ({
	holdings: many(holdingTable)
}));

export const holdingRelations = relations(holdingTable, ({ many, one }) => ({
	portfolio: one(portfolioTable, {
		fields: [holdingTable.portfolioId],
		references: [portfolioTable.id]
	}),
	investment: one(investmentTable, {
		fields: [holdingTable.investmentId],
		references: [investmentTable.id]
	}),
	transactions: many(transactionTable),
	distributions: many(distributionTable),
	amitStatements: many(amitStatementTable)
}));

export const amitStatementRelations = relations(amitStatementTable, ({ one, many }) => ({
	holding: one(holdingTable, {
		fields: [amitStatementTable.holdingId],
		references: [holdingTable.id]
	}),
	documents: many(documentTable)
}));

export const transactionRelations = relations(transactionTable, ({ one, many }) => ({
	holding: one(holdingTable, {
		fields: [transactionTable.holdingId],
		references: [holdingTable.id]
	}),
	documents: many(documentTable)
}));

export const distributionRelations = relations(distributionTable, ({ one, many }) => ({
	holding: one(holdingTable, {
		fields: [distributionTable.holdingId],
		references: [holdingTable.id]
	}),
	documents: many(documentTable)
}));

/*
  A document hangs off exactly one of the three record types; the other two columns
  are null. Drizzle needs all three declared so `with: { documents: true }` works
  from whichever side is being read.
*/
export const annualStatementRelations = relations(annualStatementTable, ({ one, many }) => ({
	holding: one(holdingTable, {
		fields: [annualStatementTable.holdingId],
		references: [holdingTable.id]
	}),
	documents: many(documentTable)
}));

export const documentRelations = relations(documentTable, ({ one }) => ({
	transaction: one(transactionTable, {
		fields: [documentTable.transactionId],
		references: [transactionTable.id]
	}),
	distribution: one(distributionTable, {
		fields: [documentTable.distributionId],
		references: [distributionTable.id]
	}),
	amitStatement: one(amitStatementTable, {
		fields: [documentTable.amitStatementId],
		references: [amitStatementTable.id]
	}),
	annualStatement: one(annualStatementTable, {
		fields: [documentTable.annualStatementId],
		references: [annualStatementTable.id]
	})
}));

export type Transaction = typeof transactionTable.$inferSelect;
export type Investment = typeof investmentTable.$inferSelect;
export type Distribution = typeof distributionTable.$inferSelect;
export type Holding = typeof holdingTable.$inferSelect;
export type AmitStatement = typeof amitStatementTable.$inferSelect;
export type Document = typeof documentTable.$inferSelect;
export type CapitalLossCarryforward = typeof capitalLossCarryforwardTable.$inferSelect;
export type AnnualStatement = typeof annualStatementTable.$inferSelect;
