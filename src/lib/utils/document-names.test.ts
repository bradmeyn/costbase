import { describe, it, expect } from 'vitest';
import {
	distributionDocumentName,
	taxStatementDocumentName,
	transactionDocumentName
} from './document-names';

describe('transactionDocumentName', () => {
	it('names a trade by date, side, holding, size and broker', () => {
		expect(
			transactionDocumentName({
				transactionDate: new Date(2026, 2, 2),
				type: 'buy',
				quantity: 6,
				platform: 'Stake',
				code: 'VGS'
			})
		).toBe('2026_03_02_buy_vgs_6_units_stake.pdf');
	});

	it('folds a two-word broker into one token', () => {
		const name = transactionDocumentName({
			transactionDate: new Date(2022, 2, 8),
			type: 'buy',
			quantity: 441,
			platform: 'SelfWealth',
			code: 'VAS'
		});
		expect(name).toBe('2022_03_08_buy_vas_441_units_selfwealth.pdf');
	});

	it('leaves the broker out when the row has none', () => {
		expect(
			transactionDocumentName({
				transactionDate: new Date(2021, 9, 20),
				type: 'sell',
				quantity: 93,
				platform: null,
				code: 'VAS'
			})
		).toBe('2021_10_20_sell_vas_93_units.pdf');
	});

	it('uses the local date, not the UTC one', () => {
		// Local midnight on 1 July is still 30 June in UTC east of Greenwich.
		expect(
			transactionDocumentName({
				transactionDate: new Date(2026, 6, 1),
				type: 'sell',
				quantity: 359,
				platform: 'Stake',
				code: 'VGS'
			})
		).toMatch(/^2026_07_01_/);
	});
});

describe('distributionDocumentName', () => {
	it('names a cash distribution', () => {
		expect(
			distributionDocumentName({ datePaid: new Date(2026, 6, 16), reinvested: false, code: 'VAS' })
		).toBe('2026_07_16_distribution_vas.pdf');
	});

	it('calls a reinvested one a reinvestment', () => {
		expect(
			distributionDocumentName({ datePaid: new Date(2025, 6, 16), reinvested: true, code: 'VGS' })
		).toBe('2025_07_16_reinvestment_vgs.pdf');
	});
});

describe('taxStatementDocumentName', () => {
	it('spans both years of the financial year', () => {
		expect(taxStatementDocumentName({ financialYear: 2026, code: 'VGS' })).toBe(
			'fy_25_26_tax_statement_vgs.pdf'
		);
	});

	it('pads a year ending in a single digit', () => {
		expect(taxStatementDocumentName({ financialYear: 2030, code: 'VAS' })).toBe(
			'fy_29_30_tax_statement_vas.pdf'
		);
	});
});
