/*
  The brokers this portfolio is held through.

  One list, used by the pickers and by the contract note parser, so a platform read
  off a note is always one the form can also offer. Adding a broker here teaches
  both at once.
*/
export const PLATFORMS = ['Stake', 'SelfWealth', 'CMC'] as const;

export type Platform = (typeof PLATFORMS)[number];

/** The listed spelling of a name, however a note capitalises it. */
export function matchPlatform(name: string): Platform | null {
	const wanted = name.trim().toLowerCase();
	return PLATFORMS.find((p) => p.toLowerCase() === wanted) ?? null;
}
