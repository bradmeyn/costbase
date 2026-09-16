import type { AmitStatement } from '$db/schemas/portfolio';

/**
 * AMIT cost base adjustments.
 *
 * An AMMA statement reports a single annual "AMIT cost base net amount" for the
 * whole holding, but cost base lives on individual parcels. The net amount is
 * apportioned pro-rata by units across the parcels still held at 30 June of that
 * financial year.
 *
 * Sign convention, per the statement:
 *   excess    -> cash distribution exceeded attribution -> REDUCES cost base
 *   shortfall -> attribution exceeded cash distribution -> INCREASES cost base
 *
 * Financial year convention: `financialYear` is the year the FY *ends* in, matching
 * the statement's own wording ("year ended 30 June 2026" -> 2026). Note this differs
 * from getCurrentFinancialYear() in cgt-calculations, which labels a year by its
 * *starting* year (FY2025-26 -> 2025).
 *
 * A parcel's cost base cannot go below zero. Where an excess would take it
 * negative, the cost base is floored at zero and the remainder is reported as an
 * immediate capital gain (CGT event E10), which the caller can surface.
 */

export interface ParcelForAdjustment {
	/** Stable identifier for the parcel (transaction id). */
	id: string;
	/** Date the parcel was acquired. */
	date: Date;
	/** Units remaining in the parcel at 30 June. */
	quantity: number;
	/** Cost base in cents before adjustment. */
	costBase: number;
}

export interface ParcelAdjustment {
	parcelId: string;
	/** Signed cents. Negative reduces the cost base, positive increases it. */
	adjustment: number;
	/** Cost base in cents after the adjustment, floored at zero. */
	adjustedCostBase: number;
	/** Cents of excess that could not be absorbed — a CGT event E10 gain. */
	excessGain: number;
}

export interface AmitAdjustmentResult {
	financialYear: number;
	/** Signed net cents applied across the holding. */
	netAmount: number;
	perParcel: ParcelAdjustment[];
	/** Total cents of unabsorbed excess across all parcels (CGT event E10). */
	totalExcessGain: number;
}

/** 30 June of the given financial year, at end of day, in local time. */
export function financialYearEnd(financialYear: number): Date {
	return new Date(financialYear, 5, 30, 23, 59, 59, 999);
}

/** 1 July that starts the given financial year, in local time. */
export function financialYearStart(financialYear: number): Date {
	return new Date(financialYear - 1, 6, 1, 0, 0, 0, 0);
}

/**
 * The signed net cost base adjustment for a statement.
 * Negative reduces cost base, positive increases it.
 */
export function netCostBaseAmount(
	statement: Pick<AmitStatement, 'amitCostBaseExcess' | 'amitCostBaseShortfall'>
): number {
	return statement.amitCostBaseShortfall - statement.amitCostBaseExcess;
}

/**
 * Apportion a statement's cost base net amount across parcels held at 30 June.
 *
 * Apportionment is by units. The last parcel absorbs any rounding remainder so
 * the distributed total always equals the statement amount exactly — cents must
 * not go missing from a tax figure.
 */
export function apportionCostBaseAdjustment(
	statement: Pick<AmitStatement, 'amitCostBaseExcess' | 'amitCostBaseShortfall' | 'financialYear'>,
	parcels: ParcelForAdjustment[]
): AmitAdjustmentResult {
	const netAmount = netCostBaseAmount(statement);
	const yearEnd = financialYearEnd(statement.financialYear);

	// Only parcels acquired on or before 30 June and still holding units take a share.
	const eligible = parcels.filter((p) => p.quantity > 0 && p.date <= yearEnd);
	const totalUnits = eligible.reduce((sum, p) => sum + p.quantity, 0);

	if (totalUnits === 0 || netAmount === 0) {
		return {
			financialYear: statement.financialYear,
			netAmount,
			perParcel: [],
			totalExcessGain: 0
		};
	}

	const perParcel: ParcelAdjustment[] = [];
	let distributed = 0;

	eligible.forEach((parcel, i) => {
		const isLast = i === eligible.length - 1;
		// Give the last parcel the remainder so the total reconciles exactly.
		const share = isLast
			? netAmount - distributed
			: Math.round((netAmount * parcel.quantity) / totalUnits);
		distributed += share;

		const raw = parcel.costBase + share;
		const adjustedCostBase = Math.max(raw, 0);
		const excessGain = raw < 0 ? -raw : 0;

		perParcel.push({ parcelId: parcel.id, adjustment: share, adjustedCostBase, excessGain });
	});

	return {
		financialYear: statement.financialYear,
		netAmount,
		perParcel,
		totalExcessGain: perParcel.reduce((sum, p) => sum + p.excessGain, 0)
	};
}
