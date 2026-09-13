import { describe, it, expect } from 'vitest';
import { calculateHoldingMetrics } from './holding-calculations';
import type { Transaction } from '$db/schemas/portfolio';

/** Minimal transaction; amounts in cents, matching the schema. */
const tx = (
	type: 'buy' | 'sell' | 'reinvestment',
	quantity: number,
	pricePerUnit: number,
	brokerage = 0
): Transaction =>
	({
		id: crypto.randomUUID(),
		holdingId: 'h',
		type,
		quantity,
		pricePerUnit,
		brokerage,
		transactionDate: new Date('2024-01-01'),
		createdAt: new Date(),
		updatedAt: new Date()
	}) as Transaction;

describe('calculateHoldingMetrics', () => {
	it('adds acquisition brokerage to the cost base', () => {
		// 100 units at $10.00 plus $9.50 brokerage = $1009.50
		const { units, costBase } = calculateHoldingMetrics([tx('buy', 100, 1000, 950)]);
		expect(units).toBe(100);
		expect(costBase).toBe(100_950);
	});

	it('excludes brokerage when none was paid', () => {
		expect(calculateHoldingMetrics([tx('buy', 100, 1000)]).costBase).toBe(100_000);
	});

	it('accumulates brokerage across several buys', () => {
		const { costBase } = calculateHoldingMetrics([
			tx('buy', 100, 1000, 950),
			tx('buy', 50, 1200, 950)
		]);
		// 100_000 + 950 + 60_000 + 950
		expect(costBase).toBe(161_900);
	});

	it('counts reinvestments as acquisitions', () => {
		const { units, costBase } = calculateHoldingMetrics([
			tx('buy', 100, 1000, 950),
			tx('reinvestment', 10, 1100, 0)
		]);
		expect(units).toBe(110);
		expect(costBase).toBe(111_950);
	});

	it('reduces units on a sale', () => {
		const { units } = calculateHoldingMetrics([
			tx('buy', 100, 1000, 950),
			tx('sell', 40, 1200, 950)
		]);
		expect(units).toBe(60);
	});

	it('returns zeroes for a fully disposed holding', () => {
		const m = calculateHoldingMetrics([tx('buy', 100, 1000, 950), tx('sell', 100, 1200, 950)]);
		expect(m).toEqual({ units: 0, averagePrice: 0, costBase: 0 });
	});

	it('handles an empty transaction list', () => {
		expect(calculateHoldingMetrics([])).toEqual({ units: 0, averagePrice: 0, costBase: 0 });
	});
});
