/**
 * Holding calculation utilities
 * Pure functions for calculating holding metrics from transactions
 */

import type { Transaction } from '$db/schemas/portfolio';

export interface HoldingMetrics {
	units: number;
	averagePrice: number;
	costBase: number;
}

export interface UnrealisedMetrics extends HoldingMetrics {
	currentPrice: number;
	currentValue: number;
	unrealisedGain: number;
	unrealisedGainPercent: number;
}

/**
 * Calculate holding metrics from transactions
 * Handles buy, sell, and reinvestment transactions
 *
 * @param transactions - Array of transactions for a holding
 * @returns Units held, average price, and cost base
 */
export function calculateHoldingMetrics(transactions: Transaction[]): HoldingMetrics {
	let totalUnits = 0;
	// Cost base in cents, tracked exactly. Deriving it from a rounded average price
	// (units * round(cost / units)) drifts by up to half a cent per unit.
	let totalCost = 0;

	/*
	  Sorted here rather than trusting the caller. A sell reduces the cost base by the
	  share of it the disposed units carry, so a sell seen before the buys that supplied
	  its units prices the whole holding wrongly — and the database returns rows in
	  whatever order it likes. Acquisitions settle before disposals on the same day,
	  since you cannot sell what you have not yet bought.
	*/
	const inOrder = [...transactions].sort((a, b) => {
		const byDate = new Date(a.transactionDate).getTime() - new Date(b.transactionDate).getTime();
		if (byDate !== 0) return byDate;
		return Number(a.type === 'sell') - Number(b.type === 'sell');
	});

	for (const transaction of inOrder) {
		if (transaction.type === 'buy' || transaction.type === 'reinvestment') {
			totalUnits += transaction.quantity;
			// Brokerage on acquisition forms part of the cost base.
			// The contract note's stated value is authoritative where present.
			totalCost +=
				(transaction.value ?? transaction.quantity * transaction.pricePerUnit) +
				transaction.brokerage;
		} else if (transaction.type === 'sell') {
			// Average cost: the disposed units take their proportional share of the cost.
			if (totalUnits > 0) {
				totalCost = Math.max(totalCost - (totalCost * transaction.quantity) / totalUnits, 0);
			}
			totalUnits -= transaction.quantity;
		}
	}

	const units = Math.max(totalUnits, 0);
	const costBase = units > 0 ? Math.round(totalCost) : 0;
	const averagePrice = units > 0 ? Math.round(costBase / units) : 0;

	return { units, averagePrice, costBase };
}

/**
 * Calculate unrealised gain metrics for a holding
 *
 * @param transactions - Array of transactions for a holding
 * @param currentPrice - Current market price per unit
 * @returns Complete metrics including unrealised gains
 */
export function calculateUnrealisedMetrics(
	transactions: Transaction[],
	currentPrice: number
): UnrealisedMetrics {
	const { units, averagePrice, costBase } = calculateHoldingMetrics(transactions);

	const currentValue = units * currentPrice;
	const unrealisedGain = currentValue - costBase;
	const unrealisedGainPercent = costBase > 0 ? (unrealisedGain / costBase) * 100 : 0;

	return {
		units,
		averagePrice,
		costBase,
		currentPrice,
		currentValue,
		unrealisedGain,
		unrealisedGainPercent
	};
}
