export type Calculator = {
	name: string;
	href: string;
	description: string;
	viewBox: string;
	paths: string[];
};

export const calculators: Calculator[] = [
	{
		name: 'Savings & FIRE',
		href: '/savings-calculator',
		description: 'Project savings growth, track a goal, or calculate your FIRE number',
		viewBox: '0 0 512 512',
		paths: [
			'M64 64c0-17.7-14.3-32-32-32S0 46.3 0 64L0 400c0 44.2 35.8 80 80 80l400 0c17.7 0 32-14.3 32-32s-14.3-32-32-32L80 416c-8.8 0-16-7.2-16-16L64 64zm406.6 86.6c12.5-12.5 12.5-32.8 0-45.3s-32.8-12.5-45.3 0L320 210.7l-57.4-57.4c-12.5-12.5-32.8-12.5-45.3 0l-112 112c-12.5 12.5-12.5 32.8 0 45.3s32.8 12.5 45.3 0L240 221.3l57.4 57.4c12.5 12.5 32.8 12.5 45.3 0l128-128z'
		]
	},
	{
		name: 'Budget Planner',
		href: '/budget-planner',
		description: 'Create and download a detailed personal budget',
		viewBox: '0 0 512 512',
		paths: [
			'M64 32C28.7 32 0 60.7 0 96L0 416c0 35.3 28.7 64 64 64l384 0c35.3 0 64-28.7 64-64l0-224c0-35.3-28.7-64-64-64L80 128c-8.8 0-16-7.2-16-16s7.2-16 16-16l368 0c17.7 0 32-14.3 32-32s-14.3-32-32-32L64 32zM416 272a32 32 0 1 1 0 64 32 32 0 1 1 0-64z'
		]
	},
	{
		name: 'Income Tax',
		href: '/income-tax-calculator',
		description: 'Estimate your Australian income tax including Medicare Levy and HELP repayments',
		viewBox: '0 0 384 512',
		paths: [
			'M14 2.2C22.5-1.7 32.5-.3 39.6 5.8L80 40.4 120.4 5.8c9-7.7 22.3-7.7 31.2 0L192 40.4 232.4 5.8c9-7.7 22.3-7.7 31.2 0L304 40.4l40.4-34.6C351.5-.3 361.5-1.7 370 2.2S384 14.1 384 23.4L384 488.6c0 9.4-5.5 17.9-14 21.2s-18.5 1.5-25.4-4.6L304 471.6l-40.4 34.6c-9 7.7-22.3 7.7-31.2 0L192 471.6l-40.4 34.6c-9 7.7-22.3 7.7-31.2 0L80 471.6 39.6 506.2c-6.9 5.9-16.9 7.9-25.4 4.6S0 497.9 0 488.6L0 23.4C0 14.1 5.5 5.6 14 2.2zM96 144c-8.8 0-16 7.2-16 16s7.2 16 16 16l192 0c8.8 0 16-7.2 16-16s-7.2-16-16-16L96 144zM80 352c0 8.8 7.2 16 16 16l192 0c8.8 0 16-7.2 16-16s-7.2-16-16-16L96 336c-8.8 0-16 7.2-16 16zM96 240c-8.8 0-16 7.2-16 16s7.2 16 16 16l192 0c8.8 0 16-7.2 16-16s-7.2-16-16-16L96 240z'
		]
	}
] as const;
