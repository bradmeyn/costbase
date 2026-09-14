/**
 * Pure CGT calculation functions for Australian tax
 * These functions are separated from the data fetching logic to make them testable
 */

export interface CGTCalculation {
	shortTermGains: number;
	lossesAppliedToShortTerm: number;
	shortTermAfterLosses: number;
	longTermGains: number;
	lossesAppliedToLongTerm: number;
	longTermAfterLosses: number;
	cgtDiscount: number;
	longTermTaxable: number;
	totalTaxableGain: number;
	/** Losses brought in from earlier years that were available this year. */
	priorYearLosses: number;
	/** Losses left over once gains are exhausted; carried forward to a later year. */
	lossesCarriedForward: number;
}

/**
 * Net a year's capital gains against its losses and apply the 50% discount.
 *
 * All amounts are in cents. `capitalLosses` and `priorYearLosses` are taken as
 * magnitudes, so either may be passed signed or unsigned.
 *
 * Losses go against short-term gains before long-term ones. That order is the
 * taxpayer's choice under the ATO rules and always the better one: a dollar of loss
 * cancels a full dollar of an undiscounted gain, but only fifty cents of a
 * discounted one.
 *
 * This year's losses and those carried in from earlier years form one pool. Which
 * is spent first cannot change the outcome — whatever is left over carries forward
 * either way — so they are applied together and only reported apart.
 */
export function calculateCGT(
	shortTermGains: number,
	longTermGains: number,
	capitalLosses: number,
	priorYearLosses: number = 0
): CGTCalculation {
	const brought = Math.abs(priorYearLosses);
	let remainingLosses = Math.abs(capitalLosses) + brought;

	// Apply losses to short-term gains first
	const lossesAppliedToShortTerm = Math.min(remainingLosses, shortTermGains);
	remainingLosses -= lossesAppliedToShortTerm;
	const shortTermAfterLosses = shortTermGains - lossesAppliedToShortTerm;

	// Apply remaining losses to long-term gains
	const lossesAppliedToLongTerm = Math.min(remainingLosses, longTermGains);
	remainingLosses -= lossesAppliedToLongTerm;
	const longTermAfterLosses = longTermGains - lossesAppliedToLongTerm;

	// Apply 50% CGT discount to long-term gains. Rounded, because an odd number of
	// cents would otherwise leave half a cent in every downstream total.
	const cgtDiscount = longTermAfterLosses > 0 ? Math.round(longTermAfterLosses / 2) : 0;
	const longTermTaxable = longTermAfterLosses - cgtDiscount;

	const totalTaxableGain = shortTermAfterLosses + longTermTaxable;

	return {
		shortTermGains,
		lossesAppliedToShortTerm,
		shortTermAfterLosses,
		longTermGains,
		lossesAppliedToLongTerm,
		longTermAfterLosses,
		cgtDiscount,
		longTermTaxable,
		totalTaxableGain,
		priorYearLosses: brought,
		lossesCarriedForward: remainingLosses
	};
}

/**
 * Get the current Australian Financial Year dates
 * FY runs from July 1 to June 30
 */
export function getCurrentFinancialYear(date: Date = new Date()): {
	year: number;
	start: Date;
	end: Date;
	label: string;
} {
	const fyYear = date.getMonth() >= 6 ? date.getFullYear() : date.getFullYear() - 1;
	const start = new Date(fyYear, 6, 1); // July 1
	const end = new Date(fyYear + 1, 5, 30, 23, 59, 59); // June 30

	return {
		year: fyYear,
		start,
		end,
		label: `FY${fyYear}-${fyYear + 1}`
	};
}
