import { describe, it, expect } from 'vitest';
import {
	apportionCostBaseAdjustment,
	netCostBaseAmount,
	financialYearEnd,
	financialYearStart,
	type ParcelForAdjustment
} from './amit-calculations';

const stmt = (fy: number, excess = 0, shortfall = 0) => ({
	financialYear: fy,
	amitCostBaseExcess: excess,
	amitCostBaseShortfall: shortfall
});

const parcel = (
	id: string,
	date: string,
	quantity: number,
	costBase: number
): ParcelForAdjustment => ({
	id,
	date: new Date(date),
	quantity,
	costBase
});

const localDate = (d: Date) =>
	`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

describe('financial year boundaries', () => {
	// Boundaries are local-time, matching getCurrentFinancialYear in cgt-calculations.
	// Asserting via toISOString would compare UTC and be off by one in AEST.
	it('FY2026 runs 1 Jul 2025 to 30 Jun 2026', () => {
		expect(localDate(financialYearStart(2026))).toBe('2025-07-01');
		expect(localDate(financialYearEnd(2026))).toBe('2026-06-30');
	});
});

describe('netCostBaseAmount', () => {
	it('excess reduces the cost base', () => {
		expect(netCostBaseAmount(stmt(2026, 1005, 0))).toBe(-1005);
	});

	it('shortfall increases the cost base', () => {
		expect(netCostBaseAmount(stmt(2026, 0, 1005))).toBe(1005);
	});

	it('nets the two when both are present', () => {
		expect(netCostBaseAmount(stmt(2026, 300, 500))).toBe(200);
	});
});

describe('apportionCostBaseAdjustment', () => {
	it('splits pro-rata by units', () => {
		const r = apportionCostBaseAdjustment(stmt(2026, 0, 1000), [
			parcel('a', '2021-08-27', 750, 100_000),
			parcel('b', '2022-02-01', 250, 40_000)
		]);
		expect(r.perParcel.map((p) => p.adjustment)).toEqual([750, 250]);
		expect(r.netAmount).toBe(1000);
	});

	it('distributes the full amount exactly despite rounding', () => {
		const r = apportionCostBaseAdjustment(stmt(2026, 0, 100), [
			parcel('a', '2021-01-01', 1, 1000),
			parcel('b', '2021-01-01', 1, 1000),
			parcel('c', '2021-01-01', 1, 1000)
		]);
		// 100 / 3 does not divide evenly; the remainder lands on the last parcel.
		expect(r.perParcel.map((p) => p.adjustment)).toEqual([33, 33, 34]);
		expect(r.perParcel.reduce((s, p) => s + p.adjustment, 0)).toBe(100);
	});

	it('reduces cost base on an excess', () => {
		const r = apportionCostBaseAdjustment(stmt(2026, 1005, 0), [
			parcel('a', '2021-08-27', 1000, 396_129)
		]);
		expect(r.perParcel[0].adjustment).toBe(-1005);
		expect(r.perParcel[0].adjustedCostBase).toBe(395_124);
		expect(r.totalExcessGain).toBe(0);
	});

	it('floors cost base at zero and reports the remainder as a CGT event E10 gain', () => {
		const r = apportionCostBaseAdjustment(stmt(2026, 5000, 0), [
			parcel('a', '2021-01-01', 100, 3000)
		]);
		expect(r.perParcel[0].adjustedCostBase).toBe(0);
		expect(r.perParcel[0].excessGain).toBe(2000);
		expect(r.totalExcessGain).toBe(2000);
	});

	it('excludes parcels acquired after 30 June', () => {
		const r = apportionCostBaseAdjustment(stmt(2026, 0, 1000), [
			parcel('held', '2025-08-01', 500, 50_000),
			parcel('after', '2026-08-01', 500, 50_000)
		]);
		expect(r.perParcel).toHaveLength(1);
		expect(r.perParcel[0].parcelId).toBe('held');
		expect(r.perParcel[0].adjustment).toBe(1000);
	});

	it('excludes fully disposed parcels', () => {
		const r = apportionCostBaseAdjustment(stmt(2026, 0, 900), [
			parcel('sold', '2021-01-01', 0, 0),
			parcel('held', '2021-01-01', 300, 30_000)
		]);
		expect(r.perParcel).toHaveLength(1);
		expect(r.perParcel[0].adjustment).toBe(900);
	});

	it('is a no-op when there is nothing to apportion', () => {
		expect(
			apportionCostBaseAdjustment(stmt(2026, 0, 0), [parcel('a', '2021-01-01', 10, 100)]).perParcel
		).toEqual([]);
		expect(apportionCostBaseAdjustment(stmt(2026, 0, 500), []).perParcel).toEqual([]);
	});

	it('matches the FY2026 VGS statement', () => {
		// Statement reports an excess of $741.61, reducing cost base.
		const r = apportionCostBaseAdjustment(stmt(2026, 74_161, 0), [
			parcel('a', '2021-10-20', 4000, 400_000),
			parcel('b', '2022-02-01', 1892, 200_000)
		]);
		expect(r.netAmount).toBe(-74_161);
		expect(r.perParcel.reduce((s, p) => s + p.adjustment, 0)).toBe(-74_161);
	});
});
