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

describe('calculateHoldingMetrics ordering', () => {
	const row = (over: Partial<Transaction>): Transaction =>
		({
			id: crypto.randomUUID(),
			holdingId: 'h',
			quantity: 0,
			pricePerUnit: 0,
			brokerage: 0,
			value: null,
			confirmationNumber: null,
			platform: null,
			transactionDate: new Date(2024, 0, 1),
			type: 'buy',
			createdAt: new Date(),
			updatedAt: new Date(),
			...over
		}) as Transaction;

	const buy = row({ quantity: 100, pricePerUnit: 10_00, transactionDate: new Date(2024, 0, 1) });
	const sell = row({
		quantity: 40,
		pricePerUnit: 15_00,
		type: 'sell',
		transactionDate: new Date(2024, 5, 1)
	});

	it('gives the same answer whatever order the rows arrive in', () => {
		const forwards = calculateHoldingMetrics([buy, sell]);
		const backwards = calculateHoldingMetrics([sell, buy]);
		expect(backwards).toEqual(forwards);
		expect(forwards).toEqual({ units: 60, costBase: 60_000, averagePrice: 10_00 });
	});

	it('settles a same-day buy before the sell that disposes of it', () => {
		const sameDayBuy = row({
			quantity: 50,
			pricePerUnit: 20_00,
			transactionDate: new Date(2024, 5, 1)
		});
		const result = calculateHoldingMetrics([sell, sameDayBuy, buy]);
		// 100 at $10 then 50 at $20 is $2,000 over 150 units; selling 40 leaves 110.
		expect(result.units).toBe(110);
		expect(result.costBase).toBe(146_667);
	});
});
