/*
  What a report is, described once.

  A report knows its own shape — which columns, which rows, what the totals are —
  and both exports are views of that. Keeping CSV and PDF as separate generators
  let them drift: a column added to one was routinely missed in the other, and
  some reports grew a CSV while others never got one at all.

  Cells are pre-formatted strings rather than numbers. A report has already decided
  how it says a dollar, a date and a blank; a second opinion at export time is how
  a figure ends up reading differently on paper than on screen.
*/

export type Align = 'left' | 'right' | 'center';

export interface ReportColumn {
	header: string;
	align?: Align;
	/** Relative width in the PDF. Left out, the column takes what it needs. */
	width?: number | '*' | 'auto';
}

export interface ReportSection {
	heading?: string;
	/** A line under the heading, for a caveat or a unit. */
	note?: string;
	columns: ReportColumn[];
	rows: string[][];
	/** A closing row set apart from the body, e.g. a total. */
	footer?: string[];
}

export interface ReportDocument {
	title: string;
	subtitle?: string;
	/** Named so the reader knows whose figures these are. */
	portfolioName?: string;
	sections: ReportSection[];
	/** Shown small at the end — scope, caveats, what the report does not know. */
	notes?: string[];
	/** Base for the download, without an extension. */
	filename: string;
}

/** RFC 4180: quote anything containing a comma, a quote or a newline. */
function csvCell(value: string): string {
	return /[",\n\r]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

export function toCsv(document: ReportDocument): string {
	const lines: string[] = [document.title];
	if (document.subtitle) lines.push(document.subtitle);

	for (const section of document.sections) {
		lines.push('');
		if (section.heading) lines.push(section.heading);
		if (section.note) lines.push(section.note);
		lines.push(section.columns.map((c) => csvCell(c.header)).join(','));
		for (const row of section.rows) lines.push(row.map(csvCell).join(','));
		if (section.footer) lines.push(section.footer.map(csvCell).join(','));
	}

	for (const note of document.notes ?? []) lines.push('', csvCell(note));
	return `${lines.join('\n')}\n`;
}
