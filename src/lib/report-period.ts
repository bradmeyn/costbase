import { financialYearStart, financialYearEnd } from '#lib/utils/amit-calculations.js';

/*
  A report's reporting window, carried in the URL as ?from=&to= so it is linkable
  and survives a refresh. Both absent means all time — the default for reports that
  are a record of activity rather than a tax return.
*/

export interface ReportWindow {
	from?: string;
	to?: string;
}

/** ISO date in local time — `toISOString()` would shift the day in Australia. */
export function isoDay(date: Date): string {
	return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

/** The financial year that contains a date, named by the year it ends in. */
export function currentFinancialYear(now = new Date()): number {
	return now.getMonth() >= 6 ? now.getFullYear() + 1 : now.getFullYear();
}

/**
 * "FY2026-27" for the year ending 30 June 2027.
 *
 * Spelt out across both calendar years because the single-year form is ambiguous
 * out loud: in September 2026 the current year is the one ending in 2027, and
 * "FY2027" reads like next year to anyone who is not thinking about end dates.
 */
export function financialYearLabel(financialYear: number): string {
	return `FY${financialYear - 1}-${String(financialYear % 100).padStart(2, '0')}`;
}

/**
 * The financial year a report is showing: the one in the URL, else the newest year
 * with activity. At tax time you want the year that just ended, not the empty one
 * you are in — and the picker and the page have to agree on that, or the heading
 * contradicts the control above it.
 */
export function readFinancialYear(
	url: { searchParams: { get(name: string): string | null } },
	years: number[]
): number {
	const chosen = Number(url.searchParams.get('fy'));
	if (Number.isInteger(chosen) && chosen > 1900) return chosen;
	return years[0] ?? currentFinancialYear();
}

export function financialYearWindow(financialYear: number): Required<ReportWindow> {
	return {
		from: isoDay(financialYearStart(financialYear)),
		to: isoDay(financialYearEnd(financialYear))
	};
}

/** Takes anything that can read a search param — `page.url` is a readonly URL. */
export function readWindow(url: {
	searchParams: { get(name: string): string | null };
}): ReportWindow {
	const valid = (v: string | null) => (v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : undefined);
	return { from: valid(url.searchParams.get('from')), to: valid(url.searchParams.get('to')) };
}

/** The financial year a window covers exactly, or null if it is some other span. */
export function matchedFinancialYear(window: ReportWindow, years: number[]): number | null {
	if (!window.from || !window.to) return null;
	return (
		years.find((year) => {
			const fy = financialYearWindow(year);
			return fy.from === window.from && fy.to === window.to;
		}) ?? null
	);
}

/** How a window reads in a subtitle. */
export function describeWindow(window: ReportWindow): string {
	const pretty = (iso: string) => {
		const [y, m, d] = iso.split('-').map(Number);
		return new Date(y, m - 1, d).toLocaleDateString('en-AU', {
			day: 'numeric',
			month: 'short',
			year: 'numeric'
		});
	};

	if (window.from && window.to) return `${pretty(window.from)} to ${pretty(window.to)}`;
	if (window.from) return `From ${pretty(window.from)}`;
	if (window.to) return `Up to ${pretty(window.to)}`;
	return 'All time';
}

/** A filename-safe tag for the window, for CSV exports. */
export function windowTag(window: ReportWindow, years: number[]): string {
	const fy = matchedFinancialYear(window, years);
	if (fy) return financialYearLabel(fy);
	if (!window.from && !window.to) return 'all-time';
	return `${window.from ?? 'start'}-to-${window.to ?? 'today'}`;
}

/*
  A quarterly ETF distribution is paid in the financial year *after* the one it
  belongs to when the quarter is the June one: the record date falls on the first
  business day of July and the money lands mid-month, but the entitlement arose at
  30 June and the fund attributes it to the year just ended. Filing those payments
  by their payment date puts a whole quarter in the wrong tax year — the AMMA for
  each year here sums the four distributions ending with the July payment, to the
  cent, which is the check this rule was written against.

  So a distribution is placed by the day its entitlement arose: a fortnight before
  the record date, which lands inside the quarter it was declared for however many
  days the registry took to strike the record. Without a record date the payment
  date is stepped back six weeks, far enough to clear the same July boundary.
*/
export function distributionEntitlementDate(distribution: {
	recordDate?: Date | string | null;
	datePaid: Date | string;
}): Date {
	const anchor = new Date(distribution.recordDate ?? distribution.datePaid);
	const date = new Date(anchor);
	date.setDate(date.getDate() - (distribution.recordDate ? 14 : 45));
	return date;
}

/** The financial year a distribution is taxed in, named by the year it ends in. */
export function distributionFinancialYear(distribution: {
	recordDate?: Date | string | null;
	datePaid: Date | string;
}): number {
	return currentFinancialYear(distributionEntitlementDate(distribution));
}
