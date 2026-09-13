/*
  Chart series, tuned for the dark ground. Sky leads (it is the app's primary),
  orange follows as the secondary accent; the rest are held apart around the hue
  wheel at similar luminance so no single series dominates a stacked or pie chart.
  Keep these in step with --chart-1..10 in app.css.
*/
export const COLOURS = [
	'oklch(0.71 0.145 234)', // sky — primary
	'oklch(0.72 0.172 47)', // orange — secondary accent
	'oklch(0.73 0.15 152)', // green — tertiary accent
	'oklch(0.68 0.16 300)', // violet
	'oklch(0.80 0.14 90)', // amber
	'oklch(0.64 0.15 265)', // indigo
	'oklch(0.74 0.14 140)', // green
	'oklch(0.70 0.13 205)', // cyan
	'oklch(0.66 0.17 20)', // crimson
	'oklch(0.76 0.11 120)' // moss
];

export const COLOUR_BRAND = 'oklch(0.71 0.145 234)';
export const COLOUR_BRAND_LIGHT = 'oklch(0.80 0.11 234)';
export const COLOUR_BRAND_DARK = 'oklch(0.55 0.14 238)';

export const BRAND = [COLOUR_BRAND, COLOUR_BRAND_LIGHT, COLOUR_BRAND_DARK];
