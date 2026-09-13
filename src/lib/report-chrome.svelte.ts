import { getContext, setContext } from 'svelte';

const KEY = Symbol('report-chrome');

/**
 * Lets the reports layout own one header row — title on the left, financial year
 * and export on the right — while each report supplies its own heading and CSV.
 *
 * Without this the title lives in the page and the controls in the layout, so they
 * cannot sit on the same line.
 */
export class ReportChrome {
	title = $state('');
	subtitle = $state('');
	/** Set by a report that can produce a CSV; null hides the CSV option. */
	csv = $state<(() => void) | null>(null);
}

export function setReportChrome(): ReportChrome {
	return setContext(KEY, new ReportChrome());
}

/**
 * Register a report's heading, and optionally a CSV generator, with the layout.
 *
 * Takes a getter rather than a plain object so the effect re-reads it. A subtitle
 * built from the selected financial year has to change when that year does;
 * passing the object directly captures its values once.
 */
export function registerReport(get: () => { title: string; subtitle?: string; csv?: () => void }) {
	const chrome = getContext<ReportChrome | undefined>(KEY);
	if (!chrome) return;
	$effect(() => {
		const { title, subtitle, csv } = get();
		chrome.title = title;
		chrome.subtitle = subtitle ?? '';
		chrome.csv = csv ?? null;
		return () => {
			chrome.csv = null;
		};
	});
}
