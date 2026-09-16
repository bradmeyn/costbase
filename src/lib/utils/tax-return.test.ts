import { describe, it, expect } from 'vitest';
import { buildTaxReturn, type StatementAmounts } from './tax-return';

/* All amounts in cents. */

const statement = (over: Partial<StatementAmounts> = {}): StatementAmounts => ({
	label13U: 0,
	label13C: 0,
	label13Q: 0,
	label13R: 0,
	label13A: 0,
	label20E: 0,
	label20M: 0,
	label20O: 0,
	discountedTap: 0,
	discountedNtap: 0,
	otherMethodTap: 0,
	otherMethodNtap: 0,
	totalCurrentYearCapitalGains: 0,
	...over
});

const input = (over: Partial<Parameters<typeof buildTaxReturn>[0]> = {}) => ({
	ownShortTermGains: 0,
	ownLongTermGains: 0,
	ownCapitalLosses: 0,
	amitExcessGains: 0,
	statements: [],
	priorYearLosses: 0,
	...over
});

describe('buildTaxReturn', () => {
	it('adds the trust labels across every statement', () => {
		const r = buildTaxReturn(
			input({
				statements: [
					statement({ label13U: 2_134_42, label13C: 11_458_32, label20E: 282_99 }),
					statement({ label13U: 59_42, label13C: 37, label20E: 13_458_49 })
				]
			})
		);
		expect(r.label13U).toBe(2_193_84);
		expect(r.label13C).toBe(11_458_69);
		expect(r.label20E).toBe(13_741_48);
	});

	it('halves a long-held gain of your own', () => {
		const r = buildTaxReturn(input({ ownLongTermGains: 100_00 }));
		expect(r.label18H).toBe(100_00);
		expect(r.label18A).toBe(50_00);
	});

	it('grosses a fund’s discounted gain back up before discounting it once', () => {
		// The fund reports 50 after its own halving; the gross gain was 100.
		const r = buildTaxReturn(
			input({
				statements: [statement({ discountedTap: 50_00, totalCurrentYearCapitalGains: 100_00 })]
			})
		);
		expect(r.trustDiscountedGrossedUp).toBe(100_00);
		expect(r.label18H).toBe(100_00);
		expect(r.label18A).toBe(50_00);
		expect(r.capitalGainsMismatch).toBeNull();
	});

	it('leaves an other-method gain undiscounted', () => {
		const r = buildTaxReturn(
			input({
				statements: [statement({ otherMethodTap: 100_00, totalCurrentYearCapitalGains: 100_00 })]
			})
		);
		expect(r.label18A).toBe(100_00);
	});

	it('spends a loss on the gross gain, not the halved one', () => {
		// 100 gross against a 100 loss leaves nothing. Applying the loss to the fund's
		// reported 50 would leave 50 gross, and tax 25 that is not owed.
		const r = buildTaxReturn(
			input({
				ownCapitalLosses: 100_00,
				statements: [statement({ discountedTap: 50_00, totalCurrentYearCapitalGains: 100_00 })]
			})
		);
		expect(r.label18A).toBe(0);
		expect(r.label18V).toBe(0);
	});

	it('applies losses carried in from earlier years', () => {
		const r = buildTaxReturn(input({ ownShortTermGains: 100_00, priorYearLosses: 30_00 }));
		expect(r.label18A).toBe(70_00);
	});

	it('carries the unused remainder to 18V', () => {
		const r = buildTaxReturn(input({ ownShortTermGains: 10_00, priorYearLosses: 50_00 }));
		expect(r.label18A).toBe(0);
		expect(r.label18V).toBe(40_00);
	});

	it('treats an E10 gain as undiscounted', () => {
		const r = buildTaxReturn(input({ amitExcessGains: 100_00 }));
		expect(r.label18H).toBe(100_00);
		expect(r.label18A).toBe(100_00);
	});

	it('flags a fund whose parts do not add up to its own total', () => {
		const r = buildTaxReturn(
			input({
				statements: [statement({ discountedTap: 50_00, totalCurrentYearCapitalGains: 120_00 })]
			})
		);
		expect(r.capitalGainsMismatch).toBe(20_00);
	});

	it('answers 18G no when nothing happened', () => {
		expect(buildTaxReturn(input()).label18G).toBe(false);
	});

	it('answers 18G yes on a loss alone', () => {
		expect(buildTaxReturn(input({ ownCapitalLosses: 10_00 })).label18G).toBe(true);
	});
});
