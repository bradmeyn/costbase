import type { Align, ReportDocument, ReportSection } from '#lib/report-document.js';

/*
  Renders a report as a PDF.

  pdfmake and its fonts are a megabyte, which no one should pay for on a page they
  are only reading, so both are pulled in when an export is first asked for.

  Laid out for a tax return rather than a brochure: portrait A4, a narrow type
  scale, and figures on a monospaced face so digits line up in a column — the one
  thing a page of money has to get right.
*/

const MUTED = '#6b7280';
const RULE = '#d1d5db';
const INK = '#111827';

type Cell = { text: string; alignment?: Align; style?: string };

const cell = (text: string, alignment?: Align, style?: string): Cell => ({
	text,
	alignment,
	style
});

function sectionContent(section: ReportSection) {
	const widths = section.columns.map((c) => c.width ?? (c.align === 'right' ? 'auto' : '*'));
	const header = section.columns.map((c) => cell(c.header, c.align ?? 'left', 'th'));
	const body = section.rows.map((row) =>
		row.map((value, i) => cell(value, section.columns[i]?.align ?? 'left', 'td'))
	);
	const footer = section.footer
		? [section.footer.map((value, i) => cell(value, section.columns[i]?.align ?? 'left', 'tf'))]
		: [];

	const content: unknown[] = [];
	if (section.heading) content.push({ text: section.heading, style: 'h2' });
	if (section.note) content.push({ text: section.note, style: 'note' });
	content.push({
		table: { headerRows: 1, widths, body: [header, ...body, ...footer] },
		layout: {
			// Rules under the header and the footer only: a grid competes with the figures.
			hLineWidth: (i: number, node: { table: { body: unknown[] } }) =>
				i === 1 || i === node.table.body.length - (section.footer ? 1 : 0) ? 0.5 : 0,
			vLineWidth: () => 0,
			hLineColor: () => RULE,
			paddingTop: () => 4,
			paddingBottom: () => 4,
			paddingLeft: (i: number) => (i === 0 ? 0 : 6),
			paddingRight: () => 0
		},
		margin: [0, 0, 0, 14]
	});
	return content;
}

export function reportToPdfDefinition(document: ReportDocument) {
	const prepared = new Date().toLocaleDateString('en-AU', {
		day: 'numeric',
		month: 'long',
		year: 'numeric'
	});

	return {
		pageSize: 'A4',
		pageMargins: [36, 40, 36, 44],
		info: { title: document.title, creator: 'Costbase' },
		content: [
			{ text: document.title, style: 'h1' },
			document.portfolioName ? { text: document.portfolioName, style: 'portfolio' } : null,
			document.subtitle ? { text: document.subtitle, style: 'subtitle' } : null,
			...document.sections.flatMap(sectionContent),
			...(document.notes ?? []).map((note) => ({ text: note, style: 'note' }))
		].filter(Boolean),
		footer: (current: number, total: number) => ({
			columns: [
				{ text: `Prepared ${prepared}`, style: 'footer' },
				{ text: `${current} of ${total}`, style: 'footer', alignment: 'right' }
			],
			margin: [36, 12, 36, 0]
		}),
		defaultStyle: { font: 'Roboto', fontSize: 8.5, color: INK, lineHeight: 1.2 },
		styles: {
			h1: { fontSize: 16, bold: true, margin: [0, 0, 0, 2] },
			portfolio: { fontSize: 9.5, margin: [0, 0, 0, 1] },
			subtitle: { fontSize: 8.5, color: MUTED, margin: [0, 0, 0, 16] },
			h2: { fontSize: 10.5, bold: true, margin: [0, 6, 0, 4] },
			note: { fontSize: 7.5, color: MUTED, margin: [0, 0, 0, 6] },
			th: { fontSize: 7.5, bold: true, color: MUTED },
			td: {},
			tf: { bold: true },
			footer: { fontSize: 7, color: MUTED }
		}
	};
}

/*
  The renderer, loaded on demand. Both modules are CommonJS wearing an ESM jacket:
  under Node the named exports are the real thing, but in a browser they are a
  hollow copy and the working object is on `default` — `createPdf` lives on its
  prototype, not on the namespace. Preferring `default` where there is one is what
  makes this work in both.
*/
async function loadRenderer() {
	const [module, fontModule] = await Promise.all([
		import('pdfmake/build/pdfmake'),
		import('pdfmake/build/vfs_fonts')
	]);
	const unwrap = <T>(m: unknown): T => ((m as { default?: T }).default ?? m) as T;
	const pdfMake = unwrap<typeof module>(module);
	pdfMake.addVirtualFileSystem(unwrap(fontModule));
	return pdfMake;
}

/** The rendered PDF, for a caller that wants the bytes rather than a download. */
export async function reportPdfBlob(document: ReportDocument): Promise<Blob> {
	const pdfMake = await loadRenderer();
	return pdfMake.createPdf(reportToPdfDefinition(document) as never).getBlob();
}

export async function downloadReportPdf(document: ReportDocument): Promise<void> {
	const pdfMake = await loadRenderer();
	pdfMake.createPdf(reportToPdfDefinition(document) as never).download(`${document.filename}.pdf`);
}
