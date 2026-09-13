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
}

/**
 * Calculate CGT with loss offsetting and discount
 * Losses are applied to short-term gains first, then long-term gains
 * Long-term gains receive a 50% discount
 */
export function calculateCGT(
	shortTermGains: number,
	longTermGains: number,
	capitalLosses: number
): CGTCalculation {
	const totalLosses = Math.abs(capitalLosses);
	let remainingLosses = totalLosses;

	// Apply losses to short-term gains first
	const lossesAppliedToShortTerm = Math.min(remainingLosses, shortTermGains);
	remainingLosses -= lossesAppliedToShortTerm;
	const shortTermAfterLosses = shortTermGains - lossesAppliedToShortTerm;

	// Apply remaining losses to long-term gains
	const lossesAppliedToLongTerm = Math.min(remainingLosses, longTermGains);
	const longTermAfterLosses = longTermGains - lossesAppliedToLongTerm;

	// Apply 50% CGT discount to long-term gains
	const cgtDiscount = longTermAfterLosses > 0 ? longTermAfterLosses * 0.5 : 0;
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
		totalTaxableGain
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
