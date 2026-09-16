import TrendingUp from '@lucide/svelte/icons/trending-up';
import Wallet from '@lucide/svelte/icons/wallet';
import Receipt from '@lucide/svelte/icons/receipt';
import type { Component } from 'svelte';

export type Calculator = {
	name: string;
	href: string;
	description: string;
	icon: Component;
};

export const calculators: Calculator[] = [
	{
		name: 'Savings & FIRE',
		href: '/savings-calculator',
		description: 'Project savings growth, track a goal, or calculate your FIRE number',
		icon: TrendingUp
	},
	{
		name: 'Budget Planner',
		href: '/budget-planner',
		description: 'Create and download a detailed personal budget',
		icon: Wallet
	},
	{
		name: 'Income Tax',
		href: '/income-tax-calculator',
		description: 'Estimate your Australian income tax including Medicare Levy and HELP repayments',
		icon: Receipt
	}
];
