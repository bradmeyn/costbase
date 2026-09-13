/**
 * Works out what disposing of units today would realise, so the CGT estimator can
 * add a hypothetical sale to what the year has already realised.
 *
 * Parcels are consumed oldest first (FIFO), matching how the rest of the app tracks
 * disposals. All amounts are in cents.
 */

export interface SimulationLot {
	date: Date | string;
	quantity: number;
	/** Cost of the units still in the parcel, excluding brokerage and AMIT adjustment. */
	costTotal: number;
	/** Brokerage paid to acquire the units still in the parcel. */
	acquisitionCosts: number;
	/** Cumulative AMIT cost base adjustment for those units; negative reduces the base. */
	costBaseAdjustment: number;
	currentPrice: number;
	/** Held more than twelve months, so eligible for the 50% discount. */
	isLongTerm: boolean;
}

export interface SaleSimulation {
	/** Units actually sold — less than asked for if the parcels run out. */
	units: number;
	proceeds: number;
	costBase: number;
	/** Positive gains only, split by discount eligibility. */
	shortTermGains: number;
	longTermGains: number;
	/** Losses as a magnitude. A long-held parcel sold at a loss is still just a loss. */
	capitalLosses: number;
	/** Proceeds less cost base across every parcel touched; losses included. */
	netGain: number;
}

const EMPTY: SaleSimulation = {
	units: 0,
	proceeds: 0,
	costBase: 0,
	shortTermGains: 0,
	longTermGains: 0,
	capitalLosses: 0,
	netGain: 0
};

export function simulateSale(lots: SimulationLot[], unitsToSell: number): SaleSimulation {
	if (unitsToSell <= 0) return { ...EMPTY };

	const oldestFirst = [...lots].sort(
		(a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
	);

	const result = { ...EMPTY };
	let remaining = unitsToSell;

	for (const lot of oldestFirst) {
		if (remaining <= 0) break;
		if (lot.quantity <= 0) continue;

		const units = Math.min(lot.quantity, remaining);
		const lotCostBase = lot.costTotal + lot.acquisitionCosts + lot.costBaseAdjustment;

		// Apportion rather than multiply a per-unit cost: the parcel's total is the
		// authoritative figure, and dividing it first loses cents on every unit.
		const costBase =
			units === lot.quantity ? lotCostBase : Math.round((lotCostBase * units) / lot.quantity);
		const proceeds = Math.round(units * lot.currentPrice);
		const gain = proceeds - costBase;

		result.units += units;
		result.proceeds += proceeds;
		result.costBase += costBase;
		result.netGain += gain;

		if (gain < 0) result.capitalLosses += -gain;
		else if (lot.isLongTerm) result.longTermGains += gain;
		else result.shortTermGains += gain;

		remaining -= units;
	}

	return result;
}
