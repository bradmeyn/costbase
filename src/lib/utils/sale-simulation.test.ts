import { describe, it, expect } from 'vitest';
import { simulateSale, type SimulationLot } from './sale-simulation';

const lot = (over: Partial<SimulationLot> = {}): SimulationLot => ({
	date: '2020-01-01',
	quantity: 100,
	costTotal: 10_000_00,
	acquisitionCosts: 0,
	costBaseAdjustment: 0,
	currentPrice: 150_00,
	isLongTerm: true,
	...over
});

describe('simulateSale', () => {
	it('returns nothing for a sale of no units', () => {
		expect(simulateSale([lot()], 0).units).toBe(0);
	});

	it('takes the oldest parcel first', () => {
		const result = simulateSale(
			[
				lot({ date: '2024-01-01', quantity: 10, costTotal: 2_000_00, isLongTerm: false }),
				lot({ date: '2020-01-01', quantity: 10, costTotal: 1_000_00 })
			],
			10
		);
		// The 2020 parcel: 10 x $150 proceeds against $1,000 cost.
		expect(result.longTermGains).toBe(500_00);
		expect(result.shortTermGains).toBe(0);
	});

	it('splits a sale that spans two parcels', () => {
		const result = simulateSale(
			[
				lot({ date: '2020-01-01', quantity: 10, costTotal: 1_000_00 }),
				lot({ date: '2026-01-01', quantity: 10, costTotal: 1_400_00, isLongTerm: false })
			],
			15
		);
		expect(result.units).toBe(15);
		expect(result.proceeds).toBe(2_250_00);
		expect(result.longTermGains).toBe(500_00); // whole 2020 parcel
		expect(result.shortTermGains).toBe(50_00); // 5 units at $150 against $700
	});

	it('stops when the parcels run out', () => {
		const result = simulateSale([lot({ quantity: 10 })], 999);
		expect(result.units).toBe(10);
	});

	it('counts brokerage and the AMIT adjustment in the cost base', () => {
		const result = simulateSale(
			[
				lot({
					quantity: 10,
					costTotal: 1_000_00,
					acquisitionCosts: 9_50,
					costBaseAdjustment: -50_00
				})
			],
			10
		);
		expect(result.costBase).toBe(959_50);
		expect(result.longTermGains).toBe(540_50);
	});

	it('books a loss on a long-held parcel as a loss, not a discountable gain', () => {
		const result = simulateSale([lot({ costTotal: 20_000_00 })], 100);
		expect(result.longTermGains).toBe(0);
		expect(result.capitalLosses).toBe(5_000_00);
		expect(result.netGain).toBe(-5_000_00);
	});

	it('apportions a partial parcel without losing cents to per-unit rounding', () => {
		// $1,000.01 over 3 units cannot divide evenly; a per-unit cost would drift.
		const result = simulateSale([lot({ quantity: 3, costTotal: 1_000_01, currentPrice: 0 })], 1);
		expect(result.costBase).toBe(33_334);
	});
});
