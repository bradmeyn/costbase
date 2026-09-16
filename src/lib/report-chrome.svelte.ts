import { getContext, setContext } from 'svelte';
import type { ReportDocument } from '#lib/report-document.js';

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
	/*
	  A report describes itself once and both exports come from that description, so
	  a column added to the screen cannot go missing from the file. Null means the
	  report has not described itself yet, and the export menu offers only printing.
	*/
	document = $state<(() => ReportDocument) | null>(null);
}

export function setReportChrome(): ReportChrome {
	return setContext(KEY, new ReportChrome());
}

/**
 * Register a report's heading, and how it exports itself, with the layout.
 *
 * Takes a getter rather than a plain object so the effect re-reads it. A subtitle
 * built from the selected financial year has to change when that year does;
 * passing the object directly captures its values once.
 *
 * `document` is likewise a function rather than a value: building one means walking
 * every row, which is wasted on every report the reader only looks at. It is called
 * when an export is actually asked for.
 */
export function registerReport(
	get: () => { title: string; subtitle?: string; document?: () => ReportDocument }
) {
	const chrome = getContext<ReportChrome | undefined>(KEY);
	if (!chrome) return;
	$effect(() => {
		const { title, subtitle, document } = get();
		chrome.title = title;
		chrome.subtitle = subtitle ?? '';
		chrome.document = document ?? null;
		return () => {
			chrome.document = null;
		};
	});
}
