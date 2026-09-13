import { getContext, setContext } from 'svelte';

const KEY = Symbol('report-export');

/**
 * Lets the reports layout own one export control while each report supplies its own
 * CSV. PDF needs nothing registered — it goes through the browser's print pipeline,
 * which every report supports by definition.
 */
export class ReportExport {
	/** Set by a report that can produce a CSV; null hides the CSV option. */
	csv = $state<(() => void) | null>(null);
	/** Filename stem shown to the user, e.g. "capital-gains-FY2026". */
	label = $state('report');
}

export function setReportExport(): ReportExport {
	return setContext(KEY, new ReportExport());
}

export function getReportExport(): ReportExport {
	return getContext<ReportExport>(KEY);
}

/**
 * Register a CSV generator for the current report. Safe to call from any report
 * page; does nothing if rendered outside the reports layout.
 */
export function registerCsv(generate: () => void, label: string) {
	const exporter = getContext<ReportExport | undefined>(KEY);
	if (!exporter) return;
	$effect(() => {
		exporter.csv = generate;
		exporter.label = label;
		return () => {
			exporter.csv = null;
		};
	});
}
