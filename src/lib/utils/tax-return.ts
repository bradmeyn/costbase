import { calculateCGT, type CGTCalculation } from './cgt-calculations.js';

/*
  Assembles an individual return's investment labels from the two things the app
  holds: disposals it worked out itself, and the attribution each fund reported on
  its annual statement.

  Every amount is in cents.
*/

/** The statement fields this needs. Loose, so the calculation can be tested alone. */
export interface StatementAmounts {
	label13U: number;
	label13C: number;
	label13Q: number;
	label13R: number;
	label13A: number;
	label20E: number;
	label20M: number;
	label20O: number;
	/** Discounted capital gains, at the discounted amount the fund reports. */
	discountedTap: number;
	discountedNtap: number;
	/** Capital gains worked out by the other method — no discount applies. */
	otherMethodTap: number;
	otherMethodNtap: number;
	/** The fund's own total, used to check the parts against the whole. */
	totalCurrentYearCapitalGains: number;
}

export interface TaxReturnInput {
	/** Gains and losses on the portfolio's own disposals. Losses as a magnitude. */
	ownShortTermGains: number;
	ownLongTermGains: number;
	ownCapitalLosses: number;
	/** Gains from an AMIT cost base excess exceeding a parcel's cost base (event E10). */
	amitExcessGains: number;
	statements: StatementAmounts[];
	/** Net capital losses carried in from earlier years, as a magnitude. */
	priorYearLosses: number;
}

export interface TaxReturn {
	/** 13 — partnerships and trusts. */
	label13U: number;
	label13C: number;
	label13Q: number;
	label13R: number;
	label13A: number;
	/** 18 — capital gains. */
	label18G: boolean;
	label18H: number;
	label18A: number;
	label18V: number;
	/** 20 — foreign source income. */
	label20E: number;
	label20M: number;
	label20O: number;
	/** The working behind 18A, so the number can be checked rather than trusted. */
	cgt: CGTCalculation;
	trustOtherMethodGains: number;
	/** The fund's discounted gains grossed back up, ready for your own discount. */
	trustDiscountedGrossedUp: number;
	/**
	 * Set when the parts of a fund's capital gains do not add up to the total it
	 * reported, which means a figure was mistyped or a line was missed.
	 */
	capitalGainsMismatch: number | null;
}

const sum = <T>(items: T[], pick: (item: T) => number) =>
	items.reduce((total, item) => total + pick(item), 0);

export function buildTaxReturn(input: TaxReturnInput): TaxReturn {
	const { statements } = input;

	/*
	  A fund reports discounted gains already halved. They have to be grossed back up
	  before your own losses touch them, because a loss cancels a dollar of gross gain
	  — applying it to the halved figure would waste half of it. The discount is then
	  applied once, at the end, with everything else.
	*/
	const trustDiscountedNet = sum(statements, (s) => s.discountedTap + s.discountedNtap);
	const trustDiscountedGrossedUp = trustDiscountedNet * 2;
	const trustOtherMethodGains = sum(statements, (s) => s.otherMethodTap + s.otherMethodNtap);

	/*
	  An E10 gain goes in undiscounted. Whether the parcel behind it had been held a
	  year is not carried through to here, and treating it as discountable when it was
	  not would understate the tax.
	*/
	const shortTermPool = input.ownShortTermGains + trustOtherMethodGains + input.amitExcessGains;
	const longTermPool = input.ownLongTermGains + trustDiscountedGrossedUp;

	const cgt = calculateCGT(
		shortTermPool,
		longTermPool,
		input.ownCapitalLosses,
		input.priorYearLosses
	);

	const label18H = shortTermPool + longTermPool;

	const reportedTotal = sum(statements, (s) => s.totalCurrentYearCapitalGains);
	const derivedTotal = trustOtherMethodGains + trustDiscountedGrossedUp;
	const capitalGainsMismatch =
		statements.length > 0 && reportedTotal !== derivedTotal ? reportedTotal - derivedTotal : null;

	return {
		label13U: sum(statements, (s) => s.label13U),
		label13C: sum(statements, (s) => s.label13C),
		label13Q: sum(statements, (s) => s.label13Q),
		label13R: sum(statements, (s) => s.label13R),
		label13A: sum(statements, (s) => s.label13A),
		label18G: label18H > 0 || input.ownCapitalLosses > 0,
		label18H,
		label18A: cgt.totalTaxableGain,
		label18V: cgt.lossesCarriedForward,
		label20E: sum(statements, (s) => s.label20E),
		label20M: sum(statements, (s) => s.label20M),
		label20O: sum(statements, (s) => s.label20O),
		cgt,
		trustOtherMethodGains,
		trustDiscountedGrossedUp,
		capitalGainsMismatch
	};
}
