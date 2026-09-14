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
	if (fy) return `FY${fy}`;
	if (!window.from && !window.to) return 'all-time';
	return `${window.from ?? 'start'}-to-${window.to ?? 'today'}`;
}
