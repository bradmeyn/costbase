import { describe, it, expect } from 'vitest';
import { toCsv, type ReportDocument } from './report-document';

const document: ReportDocument = {
	title: 'Distributions',
	subtitle: '1 July 2025 to 30 June 2026',
	filename: 'distributions-fy2025-26',
	sections: [
		{
			heading: 'Payments',
			note: 'Amounts in dollars',
			columns: [{ header: 'Paid' }, { header: 'Gross', align: 'right' }],
			rows: [
				['16 Jul 2026', '$1,389.21'],
				['20 Apr 2026', '$2,530.08']
			],
			footer: ['Total', '$3,919.29']
		}
	],
	notes: ['Every figure is this portfolio only.']
};

describe('toCsv', () => {
	it('carries the heading, the rows and the footer', () => {
		const lines = toCsv(document).split('\n');
		expect(lines[0]).toBe('Distributions');
		expect(lines).toContain('Payments');
		expect(lines).toContain('Paid,Gross');
		expect(lines).toContain('Total,"$3,919.29"');
	});

	it('quotes a cell containing a comma, so a formatted amount stays one column', () => {
		expect(toCsv(document)).toContain('16 Jul 2026,"$1,389.21"');
	});

	it('doubles an embedded quote rather than ending the field', () => {
		const quoted: ReportDocument = {
			...document,
			sections: [{ columns: [{ header: 'Note' }], rows: [['He said "sell"']] }]
		};
		expect(toCsv(quoted)).toContain('"He said ""sell"""');
	});

	it('keeps a blank cell blank rather than writing a zero', () => {
		const blanks: ReportDocument = {
			...document,
			sections: [{ columns: [{ header: 'A' }, { header: 'B' }], rows: [['', 'x']] }]
		};
		expect(toCsv(blanks)).toContain(',x');
	});

	it('ends with a newline, which is what a spreadsheet expects', () => {
		expect(toCsv(document).endsWith('\n')).toBe(true);
	});
});
