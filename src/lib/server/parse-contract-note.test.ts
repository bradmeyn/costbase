import { describe, it, expect } from 'vitest';
import { fieldsFromRows } from './parse-contract-note';

/*
  Rows here mirror the visual layout the extractor reconstructs from a Stake note.
  Real PDFs are not committed: they carry a name, address, HIN and account number.
*/
const sellRows = (over: Record<string, string> = {}): string[][] => {
	const v = {
		heading: 'SELL CONFIRMATION',
		ticker: 'VGS.ASX',
		quantity: '550',
		price: '$158.1301',
		value: 'A$86,971.54',
		execution: '11-09-2026',
		settlement: '15-09-2026',
		confirmation: '283593821',
		brokerage: 'A$8.70',
		net: 'A$86,962.84',
		...over
	};
	return [
		[v.heading],
		['TICKER', v.ticker],
		['QUANTITY', v.quantity],
		['EFFECTIVE PRICE', v.price, 'TICKER', v.ticker],
		['VALUE', v.value, 'EXECUTION DATE', v.execution],
		['CONFIRMATION NUMBER', v.confirmation, 'PID', '3556'],
		['SETTLEMENT DATE', v.settlement, 'ACCOUNT NUMBER', 'ST1944076'],
		['BROKERAGE & GST', v.brokerage, 'SIDE', 'SELL'],
		['NET PROCEEDS', v.net]
	];
};

describe('fieldsFromRows', () => {
	it('reads a sell confirmation', () => {
		const r = fieldsFromRows(sellRows());
		expect(r).toMatchObject({
			side: 'sell',
			ticker: 'VGS',
			quantity: 550,
			value: 8_697_154,
			brokerage: 870,
			netAmount: 8_696_284,
			executionDate: '2026-09-11',
			settlementDate: '2026-09-15',
			confirmationNumber: '283593821'
		});
		expect(r.warnings).toEqual([]);
	});

	it('rounds the four-decimal broker price to cents', () => {
		// $158.1301 -> 15813c. The stated value stays authoritative.
		expect(fieldsFromRows(sellRows()).pricePerUnit).toBe(15_813);
	});

	it('reads a buy confirmation and its net cost', () => {
		const rows = sellRows({ heading: 'BUY CONFIRMATION', net: 'A$86,980.24' }).map((r) =>
			r.map((c) => (c === 'NET PROCEEDS' ? 'NET COST' : c))
		);
		const r = fieldsFromRows(rows);
		expect(r.side).toBe('buy');
		// A buy nets *up* by brokerage: 86,971.54 + 8.70
		expect(r.netAmount).toBe(8_698_024);
		expect(r.warnings).toEqual([]);
	});

	it('warns when the arithmetic does not reconcile', () => {
		const r = fieldsFromRows(sellRows({ net: 'A$80,000.00' }));
		expect(r.warnings.join(' ')).toMatch(/do not reconcile/);
	});

	it('warns on an unreadable side, ticker and quantity', () => {
		const r = fieldsFromRows([
			['STATEMENT'],
			['TICKER', 'not-a-ticker'],
			['QUANTITY', 'many'],
			['VALUE', 'A$100.00']
		]);
		expect(r.side).toBeNull();
		expect(r.ticker).toBeNull();
		expect(r.quantity).toBeNull();
		expect(r.warnings).toHaveLength(4); // side, ticker, quantity, price
	});

	it('treats a missing brokerage line as zero', () => {
		const rows = sellRows().filter((r) => r[0] !== 'BROKERAGE & GST');
		expect(fieldsFromRows(rows).brokerage).toBe(0);
	});

	it('strips thousands separators', () => {
		expect(fieldsFromRows(sellRows({ value: 'A$1,234,567.89' })).value).toBe(123_456_789);
	});
});
