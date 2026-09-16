import { describe, it, expect } from 'vitest';
import {
	calculatePersonalTax,
	calculateMedicareLevy,
	calculateMedicareLevySurcharge,
	calculateHELPRepayment
} from './tax-rates';

describe('calculateMedicareLevy', () => {
	it('is 0 below threshold', () => {
		expect(calculateMedicareLevy(20000)).toBe(0);
	});

	it('applies shade-in rate in the phase-in band', () => {
		// $30,000 is in the 10% shade-in band (26001–32500)
		// levy = (30000 - 26000) * 0.1 = 400
		expect(calculateMedicareLevy(30000)).toBeCloseTo(400, 0);
	});

	it('applies 2% above threshold', () => {
		expect(calculateMedicareLevy(100000)).toBeCloseTo(2000, 0);
		expect(calculateMedicareLevy(50000)).toBeCloseTo(1000, 0);
	});
});

describe('calculateMedicareLevySurcharge', () => {
	it('is 0 when income is below $97,000', () => {
		expect(calculateMedicareLevySurcharge(90000)).toBe(0);
	});

	it('applies 1% in the first surcharge band', () => {
		// $100,000 × 1% = $1,000
		expect(calculateMedicareLevySurcharge(100000)).toBeCloseTo(1000, 0);
	});

	it('applies 1.25% in second band', () => {
		// $120,000 × 1.25% = $1,500
		expect(calculateMedicareLevySurcharge(120000)).toBeCloseTo(1500, 0);
	});

	it('applies 1.5% in top band', () => {
		// $200,000 × 1.5% = $3,000
		expect(calculateMedicareLevySurcharge(200000)).toBeCloseTo(3000, 0);
	});
});

describe('calculateHELPRepayment', () => {
	it('is 0 below minimum repayment threshold', () => {
		expect(calculateHELPRepayment(50000)).toBe(0);
	});

	it('applies correct rate in first band', () => {
		// $60,000 is in the 1% band (54435–62850) → $600
		expect(calculateHELPRepayment(60000)).toBeCloseTo(600, 0);
	});

	it('applies correct rate at higher income', () => {
		// $100,000 is in the 5.5% band (94504–100174) → $5,500
		expect(calculateHELPRepayment(100000)).toBeCloseTo(5500, 0);
	});

	it('applies 10% at top income', () => {
		// $200,000 → $20,000
		expect(calculateHELPRepayment(200000)).toBeCloseTo(20000, 0);
	});
});

describe('calculatePersonalTax', () => {
	it('returns zeros for zero income', () => {
		const result = calculatePersonalTax(0, 0, false, false);
		expect(result.totalTax).toBe(0);
		expect(result.incomeTax).toBe(0);
	});

	it('no tax below tax-free threshold', () => {
		const result = calculatePersonalTax(18200, 0, false, false);
		expect(result.incomeTax).toBe(0);
	});

	it('deductions reduce taxable income', () => {
		const without = calculatePersonalTax(80000, 0, false, false);
		const with5k = calculatePersonalTax(80000, 5000, false, false);
		expect(with5k.taxableIncome).toBe(75000);
		expect(with5k.incomeTax).toBeLessThan(without.incomeTax);
	});

	it('deductions cannot make taxable income negative', () => {
		const result = calculatePersonalTax(10000, 50000, false, false);
		expect(result.taxableIncome).toBe(0);
	});

	// $100k income, no deductions, no insurance (MLS applies), no HELP
	// Income tax: (45000-18201)×16% + (100000-45001)×30% = $4,287.84 + $16,499.70 = $20,787.54
	// Medicare levy: $100,000 × 2% = $2,000
	// Medicare levy surcharge: $100,000 × 1% = $1,000 (no private insurance)
	// Total: ~$23,788
	it('produces correct breakdown for $100k income', () => {
		const result = calculatePersonalTax(100000, 0, false, false);
		expect(result.incomeTax).toBeCloseTo(20788, -1);
		expect(result.medicareLevy).toBeCloseTo(2000, 0);
		expect(result.medicareLevySurcharge).toBeCloseTo(1000, 0);
		expect(result.totalTax).toBeCloseTo(23788, -1);
	});

	it('surcharge is 0 when hasInsurance is true', () => {
		const result = calculatePersonalTax(150000, 0, true, false);
		expect(result.medicareLevySurcharge).toBe(0);
	});

	it('surcharge is applied when hasInsurance is false and income is high enough', () => {
		const result = calculatePersonalTax(150000, 0, false, false);
		expect(result.medicareLevySurcharge).toBeGreaterThan(0);
	});

	it('HELP repayment is 0 when hasHelpDebt is false', () => {
		const result = calculatePersonalTax(100000, 0, false, false);
		expect(result.helpRepayment).toBe(0);
	});

	it('HELP repayment is applied when hasHelpDebt is true', () => {
		const result = calculatePersonalTax(100000, 0, false, true);
		expect(result.helpRepayment).toBeGreaterThan(0);
	});

	it('LITO reduces tax for low incomes', () => {
		// Below $37,500 gets full $700 LITO
		const result = calculatePersonalTax(30000, 0, false, false);
		expect(result.lowIncomeOffset).toBe(700);
	});

	it('LITO is 0 above phase-out threshold', () => {
		const result = calculatePersonalTax(70000, 0, false, false);
		expect(result.lowIncomeOffset).toBe(0);
	});

	it('totalTax is sum of all components', () => {
		const result = calculatePersonalTax(120000, 0, false, true);
		const expected =
			result.incomeTax + result.medicareLevy + result.medicareLevySurcharge + result.helpRepayment;
		expect(result.totalTax).toBeCloseTo(expected, 2);
	});
});
