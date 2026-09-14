import { describe, it, expect } from 'vitest';
import { queryWith, readList, toggle } from './report-query';

const url = (search: string) => new URL(`https://example.test/r${search}`);

describe('readList', () => {
	it('reads nothing as no filter', () => {
		expect(readList(url(''), 'holding')).toEqual([]);
		expect(readList(url('?holding='), 'holding')).toEqual([]);
	});

	it('splits a comma-separated list', () => {
		expect(readList(url('?holding=VAS,VGS'), 'holding')).toEqual(['VAS', 'VGS']);
	});

	it('drops blanks and surrounding space', () => {
		expect(readList(url('?holding=VAS, ,VGS,'), 'holding')).toEqual(['VAS', 'VGS']);
	});
});

describe('queryWith', () => {
	it('adds a value', () => {
		expect(queryWith(url('?fy=2026'), { holding: 'VAS' })).toBe('fy=2026&holding=VAS');
	});

	it('replaces a value in place of appending a second one', () => {
		expect(queryWith(url('?holding=VAS'), { holding: 'VGS' })).toBe('holding=VGS');
	});

	it('drops a key given undefined', () => {
		expect(
			queryWith(url('?from=2025-07-01&to=2026-06-30'), { from: undefined, to: undefined })
		).toBe('');
	});

	it('leaves every other param alone', () => {
		expect(queryWith(url('?from=2025-07-01&holding=VAS'), { type: 'sell' })).toBe(
			'from=2025-07-01&holding=VAS&type=sell'
		);
	});

	it('encodes what it writes', () => {
		expect(queryWith(url(''), { holding: 'A&B' })).toBe('holding=A%26B');
	});
});

describe('toggle', () => {
	it('adds and removes', () => {
		expect(toggle(['VAS'], 'VGS', true)).toEqual(['VAS', 'VGS']);
		expect(toggle(['VAS', 'VGS'], 'VAS', false)).toEqual(['VGS']);
	});

	it('does not add a value twice', () => {
		expect(toggle(['VAS'], 'VAS', true)).toEqual(['VAS']);
	});
});
