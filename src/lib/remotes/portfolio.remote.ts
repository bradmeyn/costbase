import { command, form, query } from '$app/server';
import { z } from 'zod';
import { getCurrentUser } from '#lib/remotes/auth.remote.js';
import { db } from '$db';
import { portfolioTable } from '$db/schemas/portfolio';
import { eq } from 'drizzle-orm';
import { error } from '@sveltejs/kit';
import type { InferSelectModel } from 'drizzle-orm';
import type { transactionTable } from '$db/schemas/portfolio';
import { getStockPrices } from '#lib/server/prices.js';
import { apportionCostBaseAdjustment, financialYearEnd } from '$utils/amit-calculations';
import { calculateCGT, type CGTCalculation } from '$utils/cgt-calculations';

type Transaction = InferSelectModel<typeof transactionTable>;

// Helper function to calculate units, average price, and cost base from transactions
function calculateHoldingMetrics(transactions: Transaction[]) {
	let totalUnits = 0;
	let totalCost = 0;

	for (const transaction of transactions) {
		if (transaction.type === 'buy' || transaction.type === 'reinvestment') {
			totalUnits += transaction.quantity;
			totalCost += transaction.quantity * transaction.pricePerUnit;
		} else if (transaction.type === 'sell') {
			totalUnits -= transaction.quantity;
		}
	}

	const averagePrice = totalUnits > 0 ? Math.round(totalCost / totalUnits) : 0;
	const costBase = totalUnits > 0 ? totalUnits * averagePrice : 0;

	return { units: totalUnits, averagePrice, costBase };
}

export const getPortfolios = query(async () => {
	const user = await getCurrentUser();
	if (!user) error(401, 'Unauthorized');

	const portfolios = await db.query.portfolioTable.findMany({
		where: eq(portfolioTable.userId, user.id),
		with: {
			holdings: {
				with: {
					investment: true,
					transactions: true
				}
			}
		}
	});

	return portfolios.map((portfolio) => ({
		...portfolio,
		holdings: portfolio.holdings.map((holding) => {
			const { units, averagePrice } = calculateHoldingMetrics(holding.transactions);
			return {
				...holding,
				units,
				averagePrice,
				name: holding.investment.name,
				code: holding.investment.code
			};
		})
	}));
});

export const getPortfolio = query(z.string(), async (id: string) => {
	const user = await getCurrentUser();
	if (!user) error(401, 'Unauthorized');

	const portfolio = await db.query.portfolioTable.findFirst({
		where: eq(portfolioTable.id, id),
		with: {
			holdings: {
				with: {
					investment: true,
					transactions: true
				}
			}
		}
	});

	if (!portfolio) error(404, 'Portfolio not found');
	if (portfolio.userId !== user.id) error(403, 'Forbidden');

	// Get all unique investment codes
	const codes = [...new Set(portfolio.holdings.map((h) => h.investment.code))];

	// Fetch current prices for all holdings
	const prices = await getStockPrices(codes);

	// Calculate metrics for each holding
	const holdingsWithMetrics = portfolio.holdings.map((holding) => {
		const { units, averagePrice, costBase } = calculateHoldingMetrics(holding.transactions);
		const currentPrice = prices.get(holding.investment.code) ?? averagePrice; // Fallback to avg price
		const currentValue = units * currentPrice;
		const unrealisedGain = currentValue - costBase;
		const unrealisedGainPercent = costBase > 0 ? (unrealisedGain / costBase) * 100 : 0;

		return {
			...holding,
			units,
			averagePrice,
			costBase,
			currentPrice,
			currentValue,
			unrealisedGain,
			unrealisedGainPercent,
			name: holding.investment.name,
			code: holding.investment.code
		};
	});

	// Calculate portfolio totals
	const totalCostBase = holdingsWithMetrics.reduce((sum, h) => sum + h.costBase, 0);
	const totalValue = holdingsWithMetrics.reduce((sum, h) => sum + h.currentValue, 0);
	const totalUnrealisedGain = totalValue - totalCostBase;
	const totalUnrealisedGainPercent =
		totalCostBase > 0 ? (totalUnrealisedGain / totalCostBase) * 100 : 0;

	return {
		...portfolio,
		holdings: holdingsWithMetrics,
		totalCostBase,
		totalValue,
		totalUnrealisedGain,
		totalUnrealisedGainPercent
	};
});

export const addPortfolio = form(
	z.object({
		name: z.string().min(1, 'Name is required')
	}),
	async ({ name }) => {
		const user = await getCurrentUser();
		if (!user) error(401, 'Unauthorized');

		const [newPortfolio] = await db
			.insert(portfolioTable)
			.values({
				name,
				userId: user.id
			})
			.returning();

		return { success: true, portfolio: newPortfolio };
	}
);

export const updatePortfolio = form(
	z.object({
		id: z.string(),
		name: z.string().min(1, 'Name is required')
	}),
	async ({ id, name }) => {
		const user = await getCurrentUser();
		if (!user) error(401, 'Unauthorized');

		const portfolio = await db.query.portfolioTable.findFirst({
			where: eq(portfolioTable.id, id)
		});

		if (!portfolio) {
			error(404, 'Portfolio not found');
		}

		if (portfolio.userId !== user.id) {
			error(403, 'Forbidden');
		}

		const [updatedPortfolio] = await db
			.update(portfolioTable)
			.set({ name })
			.where(eq(portfolioTable.id, id))
			.returning();

		return { success: true, portfolio: updatedPortfolio };
	}
);

export const deletePortfolio = command(
	z.object({
		id: z.string()
	}),
	async ({ id }) => {
		const user = await getCurrentUser();
		if (!user) error(401, 'Unauthorized');

		const portfolio = await db.query.portfolioTable.findFirst({
			where: eq(portfolioTable.id, id)
		});

		if (!portfolio) {
			error(404, 'Portfolio not found');
		}

		if (portfolio.userId !== user.id) {
			error(403, 'Forbidden');
		}

		await db.delete(portfolioTable).where(eq(portfolioTable.id, id));

		await getPortfolios().refresh();

		return { success: true };
	}
);

// Tax calculation types
interface TaxLot {
	date: Date;
	quantity: number;
	costPerUnit: number; // in cents
	holdingId: string;
	holdingName: string;
	holdingCode: string;
	/**
	 * Cost of the units still in this lot, in cents, excluding brokerage and AMIT
	 * adjustment. Tracked as a total rather than derived from costPerUnit because a
	 * contract note's stated value is authoritative and is not quantity * price.
	 */
	costTotal: number;
	/**
	 * Brokerage paid to acquire the units still in this lot, in cents. Part of the cost
	 * base; apportioned out as units are disposed of.
	 */
	acquisitionCosts: number;
	/**
	 * Cumulative AMIT cost base adjustment for the units still in this lot, in cents.
	 * Negative reduces cost base. Held separately from costPerUnit so partial disposals
	 * apportion it exactly rather than losing cents to per-unit rounding.
	 */
	costBaseAdjustment: number;
}

interface RealisedGain {
	holdingName: string;
	holdingCode: string;
	saleDate: Date;
	quantity: number;
	proceeds: number; // in cents
	costBase: number; // in cents
	gain: number; // in cents
	isLongTerm: boolean; // held > 12 months
}

interface UnrealisedTaxLot extends TaxLot {
	currentPrice: number;
	unrealisedGain: number;
	isLongTerm: boolean;
}

export interface TaxSummary {
	realisedGains: {
		shortTerm: RealisedGain[];
		longTerm: RealisedGain[];
		totalShortTermGain: number;
		totalLongTermGain: number;
		totalGain: number;
		totalShortTermUnits: number;
		totalLongTermUnits: number;
	};
	currentFY: {
		label: string;
		start: Date;
		end: Date;
		shortTermGains: RealisedGain[];
		longTermGains: RealisedGain[];
		capitalLosses: RealisedGain[];
		totalShortTermGains: number;
		totalLongTermGains: number;
		totalCapitalLosses: number;
		totalShortTermUnits: number;
		totalLongTermUnits: number;
		totalCapitalLossUnits: number;
		totalShortTermProceeds: number;
		totalLongTermProceeds: number;
		totalCapitalLossProceeds: number;
	};
	cgtCalculation: CGTCalculation;
	/**
	 * Capital gains arising where an AMIT cost base excess exceeded a parcel's
	 * remaining cost base (CGT event E10), keyed by holding code.
	 */
	amitExcessGains: { code: string; name: string; amount: number }[];
	unrealisedLots: UnrealisedTaxLot[];
	holdings: {
		id: string;
		name: string;
		code: string;
		units: number;
		currentPrice: number;
		currentValue: number;
		unrealisedGain: number;
	}[];
}

export const getPortfolioTaxSummary = query(
	z.object({
		id: z.string(),
		/** Year the FY ends in; defaults to the current one. */
		financialYear: z.number().int().optional()
	}),
	async ({ id, financialYear }): Promise<TaxSummary> => {
		const user = await getCurrentUser();
		if (!user) error(401, 'Unauthorized');

		const portfolio = await db.query.portfolioTable.findFirst({
			where: eq(portfolioTable.id, id),
			with: {
				holdings: {
					with: {
						investment: true,
						transactions: true,
						amitStatements: true
					}
				}
			}
		});

		if (!portfolio) error(404, 'Portfolio not found');
		if (portfolio.userId !== user.id) error(403, 'Forbidden');

		// Get current prices
		const codes = [...new Set(portfolio.holdings.map((h) => h.investment.code))];
		const prices = await getStockPrices(codes);

		const realisedGainsShortTerm: RealisedGain[] = [];
		const realisedGainsLongTerm: RealisedGain[] = [];
		const unrealisedLots: UnrealisedTaxLot[] = [];
		const holdingsSummary: TaxSummary['holdings'] = [];
		const amitExcessGainsByHolding: TaxSummary['amitExcessGains'] = [];

		for (const holding of portfolio.holdings) {
			const currentPrice = prices.get(holding.investment.code) ?? 0;

			// Sort transactions by date for FIFO processing
			const sortedTransactions = [...holding.transactions].sort(
				(a, b) => new Date(a.transactionDate).getTime() - new Date(b.transactionDate).getTime()
			);

			// Tax lots using FIFO
			const taxLots: TaxLot[] = [];

			/*
		  AMIT cost base adjustments are applied as events at 30 June of each year that
		  has a statement, interleaved with the transactions in date order. Ordering
		  matters: an adjustment must land before any later disposal, so that sale uses
		  the adjusted cost base.
		*/
			type ReplayEvent =
				| { at: Date; kind: 'tx'; tx: (typeof sortedTransactions)[number] }
				| { at: Date; kind: 'amit'; statement: (typeof holding.amitStatements)[number] };

			const events: ReplayEvent[] = [
				...sortedTransactions.map((tx) => ({
					at: new Date(tx.transactionDate),
					kind: 'tx' as const,
					tx
				})),
				...holding.amitStatements.map((statement) => ({
					at: financialYearEnd(statement.financialYear),
					kind: 'amit' as const,
					statement
				}))
			].sort((a, b) => a.at.getTime() - b.at.getTime());

			/** Cents of excess that could not be absorbed by a cost base (CGT event E10). */
			let amitExcessGains = 0;

			for (const event of events) {
				if (event.kind === 'amit') {
					const result = apportionCostBaseAdjustment(
						event.statement,
						taxLots.map((lot, i) => ({
							id: String(i),
							date: lot.date,
							quantity: lot.quantity,
							costBase: lot.costTotal + lot.acquisitionCosts + lot.costBaseAdjustment
						}))
					);
					for (const p of result.perParcel) {
						const lot = taxLots[Number(p.parcelId)];
						if (lot) lot.costBaseAdjustment += p.adjustment + p.excessGain;
					}
					amitExcessGains += result.totalExcessGain;
					continue;
				}

				const tx = event.tx;
				if (tx.type === 'buy' || tx.type === 'reinvestment') {
					// Add to tax lots
					taxLots.push({
						date: new Date(tx.transactionDate),
						quantity: tx.quantity,
						costPerUnit: tx.pricePerUnit,
						holdingId: holding.id,
						holdingName: holding.investment.name,
						holdingCode: holding.investment.code,
						costTotal: tx.value ?? tx.quantity * tx.pricePerUnit,
						acquisitionCosts: tx.brokerage,
						costBaseAdjustment: 0
					});
				} else if (tx.type === 'sell') {
					// FIFO: consume oldest lots first
					let remainingToSell = tx.quantity;
					const saleDate = new Date(tx.transactionDate);
					const salePrice = tx.pricePerUnit;

					while (remainingToSell > 0 && taxLots.length > 0) {
						const lot = taxLots[0];
						const quantityFromLot = Math.min(lot.quantity, remainingToSell);

						// Calculate gain for this portion
						// The disposed units take their proportional share of the lot's acquisition
						// brokerage and AMIT adjustment; the sale's own brokerage reduces proceeds.
						const share = (total: number) =>
							lot.quantity > 0 ? Math.round((total * quantityFromLot) / lot.quantity) : 0;
						const adjustmentShare = share(lot.costBaseAdjustment);
						const acquisitionShare = share(lot.acquisitionCosts);
						const costShare = share(lot.costTotal);

						// The sale's stated value and brokerage split across the units disposed.
						const saleValue = tx.value ?? tx.quantity * salePrice;
						const perUnitOfSale = (total: number) =>
							tx.quantity > 0 ? Math.round((total * quantityFromLot) / tx.quantity) : 0;
						const disposalCosts = perUnitOfSale(tx.brokerage);

						const proceeds = perUnitOfSale(saleValue) - disposalCosts;
						const costBase = Math.max(costShare + acquisitionShare + adjustmentShare, 0);
						const gain = proceeds - costBase;

						// Check if held > 12 months
						const holdingPeriodMs = saleDate.getTime() - lot.date.getTime();
						const isLongTerm = holdingPeriodMs > 365 * 24 * 60 * 60 * 1000;

						const realisedGain: RealisedGain = {
							holdingName: holding.investment.name,
							holdingCode: holding.investment.code,
							saleDate,
							quantity: quantityFromLot,
							proceeds,
							costBase,
							gain,
							isLongTerm
						};

						if (isLongTerm) {
							realisedGainsLongTerm.push(realisedGain);
						} else {
							realisedGainsShortTerm.push(realisedGain);
						}

						// Update lot
						lot.costBaseAdjustment -= adjustmentShare;
						lot.acquisitionCosts -= acquisitionShare;
						lot.costTotal -= costShare;
						lot.quantity -= quantityFromLot;
						remainingToSell -= quantityFromLot;

						// Remove exhausted lot
						if (lot.quantity === 0) {
							taxLots.shift();
						}
					}
				}
			}

			if (amitExcessGains > 0) {
				amitExcessGainsByHolding.push({
					code: holding.investment.code,
					name: holding.investment.name,
					amount: amitExcessGains
				});
			}

			// Remaining lots are unrealised
			let totalUnits = 0;
			let totalCostBase = 0;

			for (const lot of taxLots) {
				const holdingPeriodMs = Date.now() - lot.date.getTime();
				const isLongTerm = holdingPeriodMs > 365 * 24 * 60 * 60 * 1000;
				const lotCostBase = Math.max(
					lot.costTotal + lot.acquisitionCosts + lot.costBaseAdjustment,
					0
				);
				const unrealisedGain = lot.quantity * currentPrice - lotCostBase;

				unrealisedLots.push({
					...lot,
					currentPrice,
					unrealisedGain,
					isLongTerm
				});

				totalUnits += lot.quantity;
				totalCostBase += lotCostBase;
			}

			const currentValue = totalUnits * currentPrice;
			const unrealisedGain = currentValue - totalCostBase;

			if (totalUnits > 0) {
				holdingsSummary.push({
					id: holding.id,
					name: holding.investment.name,
					code: holding.investment.code,
					units: totalUnits,
					currentPrice,
					currentValue,
					unrealisedGain
				});
			}
		}

		// Sort by sale date
		realisedGainsShortTerm.sort((a, b) => a.saleDate.getTime() - b.saleDate.getTime());
		realisedGainsLongTerm.sort((a, b) => a.saleDate.getTime() - b.saleDate.getTime());

		const totalShortTermGain = realisedGainsShortTerm.reduce((sum, g) => sum + g.gain, 0);
		const totalLongTermGain = realisedGainsLongTerm.reduce((sum, g) => sum + g.gain, 0);
		const totalShortTermUnits = realisedGainsShortTerm.reduce((sum, g) => sum + g.quantity, 0);
		const totalLongTermUnits = realisedGainsLongTerm.reduce((sum, g) => sum + g.quantity, 0);

		// Calculate current Australian Financial Year (July 1 - June 30)
		const now = new Date();
		// financialYear names the year the FY *ends* in; fyYear is the year it starts.
		const fyYear = financialYear
			? financialYear - 1
			: now.getMonth() >= 6
				? now.getFullYear()
				: now.getFullYear() - 1;
		const fyStart = new Date(fyYear, 6, 1); // July 1
		const fyEnd = new Date(fyYear + 1, 5, 30, 23, 59, 59); // June 30

		// Filter gains/losses for current FY
		const allFYGains = [...realisedGainsLongTerm, ...realisedGainsShortTerm].filter((g) => {
			return g.saleDate >= fyStart && g.saleDate <= fyEnd;
		});

		const fyShortTermGains = allFYGains
			.filter((g) => !g.isLongTerm && g.gain > 0)
			.sort((a, b) => a.saleDate.getTime() - b.saleDate.getTime());

		const fyLongTermGains = allFYGains
			.filter((g) => g.isLongTerm && g.gain > 0)
			.sort((a, b) => a.saleDate.getTime() - b.saleDate.getTime());

		const fyCapitalLosses = allFYGains
			.filter((g) => g.gain < 0)
			.sort((a, b) => a.saleDate.getTime() - b.saleDate.getTime());

		const fyTotalShortTermGains = fyShortTermGains.reduce((sum, g) => sum + g.gain, 0);
		const fyTotalLongTermGains = fyLongTermGains.reduce((sum, g) => sum + g.gain, 0);
		const fyTotalCapitalLosses = fyCapitalLosses.reduce((sum, g) => sum + g.gain, 0);

		const fyTotalShortTermUnits = fyShortTermGains.reduce((sum, g) => sum + g.quantity, 0);
		const fyTotalLongTermUnits = fyLongTermGains.reduce((sum, g) => sum + g.quantity, 0);
		const fyTotalCapitalLossUnits = fyCapitalLosses.reduce((sum, g) => sum + g.quantity, 0);

		const fyTotalShortTermProceeds = fyShortTermGains.reduce((sum, g) => sum + g.proceeds, 0);
		const fyTotalLongTermProceeds = fyLongTermGains.reduce((sum, g) => sum + g.proceeds, 0);
		const fyTotalCapitalLossProceeds = fyCapitalLosses.reduce((sum, g) => sum + g.proceeds, 0);

		const cgtCalculation = calculateCGT(
			fyTotalShortTermGains,
			fyTotalLongTermGains,
			fyTotalCapitalLosses
		);

		return {
			realisedGains: {
				shortTerm: realisedGainsShortTerm,
				longTerm: realisedGainsLongTerm,
				totalShortTermGain,
				totalLongTermGain,
				totalGain: totalShortTermGain + totalLongTermGain,
				totalShortTermUnits,
				totalLongTermUnits
			},
			currentFY: {
				label: `FY${fyYear}-${fyYear + 1}`,
				start: fyStart,
				end: fyEnd,
				shortTermGains: fyShortTermGains,
				longTermGains: fyLongTermGains,
				capitalLosses: fyCapitalLosses,
				totalShortTermGains: fyTotalShortTermGains,
				totalLongTermGains: fyTotalLongTermGains,
				totalCapitalLosses: fyTotalCapitalLosses,
				totalShortTermUnits: fyTotalShortTermUnits,
				totalLongTermUnits: fyTotalLongTermUnits,
				totalCapitalLossUnits: fyTotalCapitalLossUnits,
				totalShortTermProceeds: fyTotalShortTermProceeds,
				totalLongTermProceeds: fyTotalLongTermProceeds,
				totalCapitalLossProceeds: fyTotalCapitalLossProceeds
			},
			cgtCalculation,
			amitExcessGains: amitExcessGainsByHolding,
			unrealisedLots,
			holdings: holdingsSummary
		};
	}
);

export const getPortfolioUnrealisedGains = query(
	z.string(),
	async (
		id: string
	): Promise<{ unrealisedLots: UnrealisedTaxLot[]; holdings: TaxSummary['holdings'] }> => {
		const user = await getCurrentUser();
		if (!user) error(401, 'Unauthorized');

		const portfolio = await db.query.portfolioTable.findFirst({
			where: eq(portfolioTable.id, id),
			with: {
				holdings: {
					with: {
						investment: true,
						transactions: true,
						amitStatements: true
					}
				}
			}
		});

		if (!portfolio) error(404, 'Portfolio not found');
		if (portfolio.userId !== user.id) error(403, 'Forbidden');

		// Get current prices
		const codes = [...new Set(portfolio.holdings.map((h) => h.investment.code))];
		const prices = await getStockPrices(codes);

		const unrealisedLots: UnrealisedTaxLot[] = [];
		const holdingsSummary: TaxSummary['holdings'] = [];

		for (const holding of portfolio.holdings) {
			const currentPrice = prices.get(holding.investment.code) ?? 0;

			// Sort transactions by date for FIFO processing
			const sortedTransactions = [...holding.transactions].sort(
				(a, b) => new Date(a.transactionDate).getTime() - new Date(b.transactionDate).getTime()
			);

			// Tax lots using FIFO, with AMIT cost base adjustments interleaved at each
			// 30 June so the unrealised figures match the capital gains report.
			const taxLots: TaxLot[] = [];

			type ReplayEvent =
				| { at: Date; kind: 'tx'; tx: (typeof sortedTransactions)[number] }
				| { at: Date; kind: 'amit'; statement: (typeof holding.amitStatements)[number] };

			const events: ReplayEvent[] = [
				...sortedTransactions.map((tx) => ({
					at: new Date(tx.transactionDate),
					kind: 'tx' as const,
					tx
				})),
				...holding.amitStatements.map((statement) => ({
					at: financialYearEnd(statement.financialYear),
					kind: 'amit' as const,
					statement
				}))
			].sort((a, b) => a.at.getTime() - b.at.getTime());

			for (const event of events) {
				if (event.kind === 'amit') {
					const result = apportionCostBaseAdjustment(
						event.statement,
						taxLots.map((lot, i) => ({
							id: String(i),
							date: lot.date,
							quantity: lot.quantity,
							costBase: lot.costTotal + lot.acquisitionCosts + lot.costBaseAdjustment
						}))
					);
					for (const p of result.perParcel) {
						const lot = taxLots[Number(p.parcelId)];
						if (lot) lot.costBaseAdjustment += p.adjustment + p.excessGain;
					}
					continue;
				}

				const tx = event.tx;
				if (tx.type === 'buy' || tx.type === 'reinvestment') {
					// Add to tax lots
					taxLots.push({
						date: new Date(tx.transactionDate),
						quantity: tx.quantity,
						costPerUnit: tx.pricePerUnit,
						holdingId: holding.id,
						holdingName: holding.investment.name,
						holdingCode: holding.investment.code,
						costTotal: tx.value ?? tx.quantity * tx.pricePerUnit,
						acquisitionCosts: tx.brokerage,
						costBaseAdjustment: 0
					});
				} else if (tx.type === 'sell') {
					// FIFO: consume oldest lots first
					let remainingToSell = tx.quantity;

					while (remainingToSell > 0 && taxLots.length > 0) {
						const lot = taxLots[0];
						const quantityFromLot = Math.min(lot.quantity, remainingToSell);

						// Update lot, carrying its share of the AMIT adjustment out with the units
						const share = (total: number) =>
							lot.quantity > 0 ? Math.round((total * quantityFromLot) / lot.quantity) : 0;
						lot.costBaseAdjustment -= share(lot.costBaseAdjustment);
						lot.acquisitionCosts -= share(lot.acquisitionCosts);
						lot.costTotal -= share(lot.costTotal);
						lot.quantity -= quantityFromLot;
						remainingToSell -= quantityFromLot;

						// Remove exhausted lot
						if (lot.quantity === 0) {
							taxLots.shift();
						}
					}
				}
			}

			// Remaining lots are unrealised
			let totalUnits = 0;
			let totalCostBase = 0;

			for (const lot of taxLots) {
				const holdingPeriodMs = Date.now() - lot.date.getTime();
				const isLongTerm = holdingPeriodMs > 365 * 24 * 60 * 60 * 1000;
				const lotCostBase = Math.max(
					lot.costTotal + lot.acquisitionCosts + lot.costBaseAdjustment,
					0
				);
				const unrealisedGain = lot.quantity * currentPrice - lotCostBase;

				unrealisedLots.push({
					...lot,
					currentPrice,
					unrealisedGain,
					isLongTerm
				});

				totalUnits += lot.quantity;
				totalCostBase += lotCostBase;
			}

			const currentValue = totalUnits * currentPrice;
			const unrealisedGain = currentValue - totalCostBase;

			if (totalUnits > 0) {
				holdingsSummary.push({
					id: holding.id,
					name: holding.investment.name,
					code: holding.investment.code,
					units: totalUnits,
					currentPrice,
					currentValue,
					unrealisedGain
				});
			}
		}

		return {
			unrealisedLots,
			holdings: holdingsSummary
		};
	}
);

/** Financial years (by ending year) that have a disposal or an AMMA statement. */
export const getPortfolioFinancialYears = query(z.string(), async (id: string) => {
	const summary = await getPortfolioTaxSummary({ id });
	const fyOf = (d: Date) => (d.getMonth() >= 6 ? d.getFullYear() + 1 : d.getFullYear());

	const years = new Set<number>([
		...summary.realisedGains.shortTerm.map((g) => fyOf(new Date(g.saleDate))),
		...summary.realisedGains.longTerm.map((g) => fyOf(new Date(g.saleDate)))
	]);

	// Only years with activity. At tax time you want the year that just ended, not
	// the empty one you are in, so the newest of these becomes the default.
	if (years.size === 0) {
		const now = new Date();
		years.add(now.getMonth() >= 6 ? now.getFullYear() + 1 : now.getFullYear());
	}

	return [...years].sort((a, b) => b - a);
});

/** 1 July to 30 June of the financial year named by the year it ends in. */
function fyRange(financialYear: number) {
	return {
		start: new Date(financialYear - 1, 6, 1),
		end: new Date(financialYear, 5, 30, 23, 59, 59, 999)
	};
}

/** Every transaction in a financial year, newest first, flattened across holdings. */
export const getPortfolioTransactions = query(
	z.object({ id: z.string(), financialYear: z.number().int() }),
	async ({ id, financialYear }) => {
		const user = await getCurrentUser();
		if (!user) error(401, 'Unauthorized');

		const portfolio = await db.query.portfolioTable.findFirst({
			where: eq(portfolioTable.id, id),
			with: { holdings: { with: { investment: true, transactions: true } } }
		});
		if (!portfolio) error(404, 'Portfolio not found');
		if (portfolio.userId !== user.id) error(403, 'Forbidden');

		const { start, end } = fyRange(financialYear);

		return portfolio.holdings
			.flatMap((h) =>
				h.transactions.map((t) => ({
					...t,
					holdingId: h.id,
					code: h.investment.code,
					name: h.investment.name,
					/** Consideration as stated on the note where known. */
					total: t.value ?? t.quantity * t.pricePerUnit
				}))
			)
			.filter((t) => {
				const d = new Date(t.transactionDate);
				return d >= start && d <= end;
			})
			.sort(
				(a, b) => new Date(b.transactionDate).getTime() - new Date(a.transactionDate).getTime()
			);
	}
);

/** Every distribution paid in a financial year, newest first. */
export const getPortfolioDistributions = query(
	z.object({ id: z.string(), financialYear: z.number().int() }),
	async ({ id, financialYear }) => {
		const user = await getCurrentUser();
		if (!user) error(401, 'Unauthorized');

		const portfolio = await db.query.portfolioTable.findFirst({
			where: eq(portfolioTable.id, id),
			with: { holdings: { with: { investment: true, distributions: true } } }
		});
		if (!portfolio) error(404, 'Portfolio not found');
		if (portfolio.userId !== user.id) error(403, 'Forbidden');

		const { start, end } = fyRange(financialYear);

		return portfolio.holdings
			.flatMap((h) =>
				h.distributions.map((d) => ({
					...d,
					code: h.investment.code,
					name: h.investment.name,
					net: d.grossPayment - d.taxWithheld
				}))
			)
			.filter((d) => {
				const paid = new Date(d.datePaid);
				return paid >= start && paid <= end;
			})
			.sort((a, b) => new Date(b.datePaid).getTime() - new Date(a.datePaid).getTime());
	}
);
