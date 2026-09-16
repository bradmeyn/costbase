import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
	return twMerge(clsx(inputs));
}

/**
 * Format an amount held in CENTS, as the database stores money.
 *
 * Not to be confused with formatCurrency in utils/formatters.ts, which takes
 * DOLLARS and is for the calculators. Passing cents to that one renders every
 * figure a hundred times too large.
 */
export function formatCurrency(amount: number, currency: string = 'USD'): string {
	return new Intl.NumberFormat('en-US', {
		style: 'currency',
		currency
		// `-0` is what negating an empty deduction produces, and it formats as
		// "-$0.00". No amount of money is negative zero, so flatten it first.
	}).format(amount === 0 ? 0 : amount / 100); // assuming amount is in cents
}

export function formatPercent(value: number): string {
	return `${(value / 100).toFixed(2)}%`; // assuming value is in basis points
}

/**
 * Check if an asset is eligible for the 50% CGT discount in Australia
 * Must be held for more than 12 months
 */
export function isEligibleForCgtDiscount(purchaseDate: Date): boolean {
	const now = new Date();
	const oneYearAgo = new Date(now);
	oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
	return purchaseDate < oneYearAgo;
}

/**
 * Download a CSV file with the given content
 * @param content - The CSV content as a string
 * @param filename - The name of the file to download (without .csv extension)
 */
export function downloadCSV(content: string, filename: string): void {
	const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
	const link = document.createElement('a');
	const url = URL.createObjectURL(blob);
	link.setAttribute('href', url);
	link.setAttribute('download', `${filename}.csv`);
	link.style.visibility = 'hidden';
	document.body.appendChild(link);
	link.click();
	document.body.removeChild(link);
	URL.revokeObjectURL(url);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type WithoutChild<T> = T extends { child?: any } ? Omit<T, 'child'> : T;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type WithoutChildren<T> = T extends { children?: any } ? Omit<T, 'children'> : T;
export type WithoutChildrenOrChild<T> = WithoutChildren<WithoutChild<T>>;
export type WithElementRef<T, U extends HTMLElement = HTMLElement> = T & { ref?: U | null };
