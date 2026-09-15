import { describe, it, expect } from 'vitest';
import { unzipSync, zipSync, strFromU8 } from 'fflate';
import { buildZipEntries, filterDocuments, type PortfolioDocument } from './documents-filter';

const doc = (over: Partial<PortfolioDocument> = {}): PortfolioDocument => ({
	id: 'd1',
	kind: 'transaction',
	code: 'VAS',
	name: '2026_03_02_buy_vas_6_units_stake.pdf',
	filename: 'ContractNote.pdf',
	sizeBytes: 1024,
	path: '2026/03/one.pdf',
	dated: '2026-03-02',
	asAt: '2026-03-02',
	financialYear: null,
	...over
});

const bytes = async () => new Uint8Array([1, 2, 3]);

describe('filterDocuments', () => {
	const documents = [
		doc({ id: 'trade', asAt: '2026-03-02' }),
		// Paid in July, but declared for the year that ended in June.
		doc({
			id: 'june-quarter',
			kind: 'distribution',
			dated: '2026-07-16',
			asAt: '2026-06-18',
			name: '2026_07_16_distribution_vas.pdf'
		}),
		doc({ id: 'vgs', code: 'VGS', asAt: '2026-03-02' }),
		doc({ id: 'statement', kind: 'amitStatement', asAt: '2026-06-30', financialYear: 2026 })
	];

	it('an empty filter is everything', () => {
		expect(filterDocuments(documents, {})).toHaveLength(4);
		expect(filterDocuments(documents, { kinds: [], codes: [] })).toHaveLength(4);
	});

	it('keeps a July payment inside the year it was declared for', () => {
		const inFy = filterDocuments(documents, { from: '2025-07-01', to: '2026-06-30' });
		expect(inFy.map((d) => d.id)).toContain('june-quarter');
	});

	it('narrows by kind and by holding', () => {
		expect(filterDocuments(documents, { kinds: ['distribution'] }).map((d) => d.id)).toEqual([
			'june-quarter'
		]);
		expect(filterDocuments(documents, { codes: ['VGS'] }).map((d) => d.id)).toEqual(['vgs']);
	});
});

describe('buildZipEntries', () => {
	it('folders by holding and kind', async () => {
		const files = await buildZipEntries(
			[
				doc(),
				doc({ id: 'd2', kind: 'amitStatement', name: 'fy_25_26_tax_statement_vas.pdf' }),
				doc({ id: 'd3', code: 'VGS', name: '2026_03_02_buy_vgs_6_units_stake.pdf' })
			],
			bytes
		);
		expect(Object.keys(files).sort()).toEqual([
			'vas/tax-statements/fy_25_26_tax_statement_vas.pdf',
			'vas/transactions/2026_03_02_buy_vas_6_units_stake.pdf',
			'vgs/transactions/2026_03_02_buy_vgs_6_units_stake.pdf'
		]);
	});

	it('numbers a second document that would take the same name', async () => {
		const files = await buildZipEntries([doc(), doc({ id: 'd2' })], bytes);
		expect(Object.keys(files).sort()).toEqual([
			'vas/transactions/2026_03_02_buy_vas_6_units_stake.pdf',
			'vas/transactions/2026_03_02_buy_vas_6_units_stake_2.pdf'
		]);
	});

	it('notes a file the store has lost instead of failing', async () => {
		const files = await buildZipEntries([doc(), doc({ id: 'gone', path: 'missing.pdf' })], (path) =>
			Promise.resolve(path === 'missing.pdf' ? null : new Uint8Array([1]))
		);
		expect(Object.keys(files)).toContain('MISSING.txt');
		expect(strFromU8(files['MISSING.txt'])).toContain('2026_03_02_buy_vas_6_units_stake.pdf');
	});

	it('produces an archive that unzips to the same paths', async () => {
		const files = await buildZipEntries([doc()], bytes);
		const round = unzipSync(zipSync(files, { level: 0 }));
		expect(Object.keys(round)).toEqual(['vas/transactions/2026_03_02_buy_vas_6_units_stake.pdf']);
	});
});
