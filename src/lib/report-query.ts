/*
  A report's controls all write to the same query string, so the string is built in
  one place. Values are kept human-readable — ?holding=VAS,VGS rather than ids —
  because a filtered report is a link someone may read before they click it.
*/

/** Comma-separated list param. An empty list means no filter, not "none". */
export function readList(
	url: { searchParams: { get(name: string): string | null } },
	key: string
): string[] {
	const raw = url.searchParams.get(key);
	if (!raw) return [];
	return raw
		.split(',')
		.map((v) => v.trim())
		.filter(Boolean);
}

/**
 * The current query with `patch` applied — an undefined value drops its key, and
 * everything else the page carries is left alone.
 *
 * Built from pairs rather than URLSearchParams: none of this is reactive state, and
 * a mutable instance would be the wrong tool for a value read once and thrown away.
 */
export function queryWith(
	url: { searchParams: Iterable<[string, string]> },
	patch: Record<string, string | undefined>
): string {
	const params = [...url.searchParams].filter(([key]) => !(key in patch));
	for (const [key, value] of Object.entries(patch)) {
		if (value) params.push([key, value]);
	}
	return params
		.map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
		.join('&');
}

/** Toggle one value in a list, for a checkbox in a filter menu. */
export function toggle(list: string[], value: string, on: boolean): string[] {
	return on ? [...new Set([...list, value])] : list.filter((v) => v !== value);
}

/** The transaction kinds a report can be narrowed to. */
export const TRANSACTION_TYPES = [
	{ value: 'buy', label: 'Buys' },
	{ value: 'sell', label: 'Sells' },
	{ value: 'reinvestment', label: 'Reinvestments' }
];
