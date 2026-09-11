import { FREQUENCIES, type FrequencyType } from '#lib/constants/frequencies.js';

/** Convert an amount from one frequency to another (e.g. weekly -> monthly). */
export function convertFrequency(amount: number, from: string, to: FrequencyType): number {
	const f = FREQUENCIES[from as FrequencyType];
	if (!f) return amount;
	const annual = amount * f.value;
	return annual / FREQUENCIES[to].value;
}

/** Normalise an amount at a given frequency to a monthly figure. */
export function toMonthly(amount: number, frequency: string): number {
	return convertFrequency(amount, frequency, 'monthly');
}

/** Human label for a frequency, e.g. "weekly" -> "Weekly". */
export function formatFrequency(frequency: string): string {
	return FREQUENCIES[frequency as FrequencyType]?.label ?? frequency;
}
