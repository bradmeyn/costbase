import { describe, it, expect } from 'vitest';
import { calculateCGT, getCurrentFinancialYear } from './cgt-calculations';

/* All amounts in cents. */

describe('calculateCGT', () => {
	it('halves a long-term gain and leaves a short-term one whole', () => {
		const r = calculateCGT(100_00, 200_00, 0);
		expect(r.cgtDiscount).toBe(100_00);
		expect(r.longTermTaxable).toBe(100_00);
		expect(r.totalTaxableGain).toBe(200_00);
	});

	it('spends losses on short-term gains before long-term ones', () => {
		// 300 of losses: all 100 of short-term goes first, 200 against long-term.
		const r = calculateCGT(100_00, 500_00, 300_00);
		expect(r.lossesAppliedToShortTerm).toBe(100_00);
		expect(r.lossesAppliedToLongTerm).toBe(200_00);
		expect(r.shortTermAfterLosses).toBe(0);
		expect(r.longTermAfterLosses).toBe(300_00);
		expect(r.totalTaxableGain).toBe(150_00);
	});

	it('is indifferent to the sign of the losses passed in', () => {
		expect(calculateCGT(100_00, 0, -40_00)).toEqual(calculateCGT(100_00, 0, 40_00));
	});

	it('carries forward losses that outrun the gains', () => {
		const r = calculateCGT(100_00, 100_00, 500_00);
		expect(r.totalTaxableGain).toBe(0);
		expect(r.lossesCarriedForward).toBe(300_00);
	});

	it('never reports a negative taxable gain', () => {
		expect(calculateCGT(0, 0, 250_00).totalTaxableGain).toBe(0);
	});

	it('keeps the discount whole so the parts still sum to the total', () => {
		// 5555c halves to 2777.5c; rounding one side keeps the pair reconciling.
		const r = calculateCGT(0, 5555, 0);
		expect(r.cgtDiscount).toBe(2778);
		expect(r.longTermTaxable).toBe(2777);
		expect(r.cgtDiscount + r.longTermTaxable).toBe(r.longTermAfterLosses);
		expect(Number.isInteger(r.totalTaxableGain)).toBe(true);
	});
});

describe('getCurrentFinancialYear', () => {
	it('labels July as the start of a new year', () => {
		expect(getCurrentFinancialYear(new Date(2026, 6, 1)).label).toBe('FY2026-2027');
	});

	it('keeps June in the year that began the previous July', () => {
		expect(getCurrentFinancialYear(new Date(2026, 5, 30)).label).toBe('FY2025-2026');
	});
});

describe('calculateCGT with losses carried forward', () => {
	it('spends a prior year loss the same way as this year’s', () => {
		const r = calculateCGT(100_00, 0, 0, 40_00);
		expect(r.lossesAppliedToShortTerm).toBe(40_00);
		expect(r.totalTaxableGain).toBe(60_00);
		expect(r.priorYearLosses).toBe(40_00);
	});

	it('pools both kinds of loss', () => {
		// 30 this year + 30 brought in, against 100 of short-term gains.
		const r = calculateCGT(100_00, 0, 30_00, 30_00);
		expect(r.lossesAppliedToShortTerm).toBe(60_00);
		expect(r.totalTaxableGain).toBe(40_00);
	});

	it('carries the unused remainder on', () => {
		const r = calculateCGT(10_00, 0, 0, 50_00);
		expect(r.totalTaxableGain).toBe(0);
		expect(r.lossesCarriedForward).toBe(40_00);
	});

	it('still favours undiscounted gains when the losses are brought in', () => {
		// Spending the loss on the long-term gain would waste half of it.
		const r = calculateCGT(50_00, 100_00, 0, 50_00);
		expect(r.lossesAppliedToShortTerm).toBe(50_00);
		expect(r.lossesAppliedToLongTerm).toBe(0);
		expect(r.totalTaxableGain).toBe(50_00);
	});

	it('is indifferent to the sign it is given', () => {
		expect(calculateCGT(100_00, 0, 0, -40_00)).toEqual(calculateCGT(100_00, 0, 0, 40_00));
	});

	it('defaults to none, leaving existing behaviour unchanged', () => {
		expect(calculateCGT(100_00, 0, 20_00).totalTaxableGain).toBe(80_00);
	});
});
