import { FREQUENCIES, type FrequencyType } from '#lib/constants/frequencies.js';
import { setContext, getContext } from 'svelte';
import { defaultBudgetItems, defaultCategories } from './default-budget-items';
import { browser } from '$app/env';

export type BudgetItem = {
	id: string;
	name: string;
	amount: number;
	category: string;
	frequency: FrequencyType;
	type: 'income' | 'expense';
};

export function convertToFrequency(
	amount: number,
	fromFrequency: FrequencyType,
	toFrequency: FrequencyType
) {
	const annualAmount = amount * FREQUENCIES[fromFrequency].value;
	return annualAmount / FREQUENCIES[toFrequency].value;
}

export function calculateCategoryTotal(
	items: BudgetItem[],
	category: string,
	toFrequency: FrequencyType
): number {
	const annualTotal = items
		.filter((item) => item.category === category)
		.reduce((acc, item) => acc + item.amount * FREQUENCIES[item.frequency].value, 0);

	return convertToFrequency(annualTotal, 'annually', toFrequency);
}

class Budget {
	hasSavedBudget = $state<boolean>(false);
	showLoadPrompt = $state<boolean>(false);

	constructor() {
		this.checkForSavedData();
	}

	private checkForSavedData() {
		if (browser) {
			const storedBudget = localStorage.getItem('budget-data');
			if (storedBudget) {
				this.hasSavedBudget = true;
				this.showLoadPrompt = true;
			}
		}
	}

	loadBudget() {
		if (!browser) return;
		try {
			const saved = localStorage.getItem('budget-data');
			if (saved) {
				const data = JSON.parse(saved);
				this.budgetItems = data.budgetItems || defaultBudgetItems;
				this.categories = data.categories || defaultCategories;
			}
		} catch (error) {
			console.error('Failed to load budget data:', error);
		} finally {
			this.showLoadPrompt = false;
		}
	}

	frequency = $state<FrequencyType>('monthly');
	budgetItems = $state<BudgetItem[]>(defaultBudgetItems);

	// Items by type
	income = $derived<BudgetItem[]>(this.budgetItems.filter((i) => i.type === 'income'));
	expenses = $derived<BudgetItem[]>(this.budgetItems.filter((i) => i.type === 'expense'));

	// Categories
	categories = $state({
		income: defaultCategories.income,
		expense: defaultCategories.expense
	});

	addCategory(type: BudgetItem['type'], category: string) {
		this.categories[type].push(category);
		this.saveToStorage();
	}
	deleteCategory(type: BudgetItem['type'], category: string) {
		// Remove items with this category
		this.budgetItems = this.budgetItems.filter(
			(item) => !(item.type === type && item.category === category)
		);
		// Remove category from the list
		const index = this.categories[type].indexOf(category);
		if (index !== -1) {
			this.categories[type].splice(index, 1);
		}
		this.saveToStorage();
	}
	updateCategory(type: BudgetItem['type'], oldCategory: string, newCategory: string) {
		const index = this.categories[type].indexOf(oldCategory);
		if (index !== -1) {
			this.categories[type][index] = newCategory;
			// Update all items in this category
			this.budgetItems.forEach((item) => {
				if (item.category === oldCategory && item.type === type) {
					item.category = newCategory;
				}
			});
		}
		this.saveToStorage();
	}
	deleteItemsByCategory(type: BudgetItem['type'], category: string) {
		this.budgetItems = this.budgetItems.filter(
			(item) => !(item.type === type && item.category === category)
		);
		this.saveToStorage();
	}

	// Frequency-adjusted items
	adjustedincome = $derived<BudgetItem[]>(
		this.income.map((item) => ({
			...item,
			amount: convertToFrequency(item.amount, item.frequency, this.frequency)
		}))
	);
	adjustedexpenses = $derived<BudgetItem[]>(
		this.expenses.map((item) => ({
			...item,
			amount: convertToFrequency(item.amount, item.frequency, this.frequency)
		}))
	);

	expenseByCategory = $derived<{ category: string; total: number }[]>(
		this.categories.expense.map((category) => {
			const categoryexpenses = this.adjustedexpenses.filter((i) => i.category === category);
			const total = categoryexpenses.reduce((acc, i) => acc + i.amount, 0);
			return { category, total };
		})
	);

	// Calculate totals for current frequency
	totalIncome = $derived<number>(this.adjustedincome.reduce((acc, i) => acc + i.amount, 0));
	totalExpenses = $derived<number>(this.adjustedexpenses.reduce((acc, i) => acc + i.amount, 0));
	unallocated = $derived<number>(this.totalIncome - this.totalExpenses);

	addItem(item: BudgetItem) {
		this.budgetItems.push(item);
		this.saveToStorage();
	}

	removeItem(id: string) {
		const index = this.budgetItems.findIndex((i) => i.id === id);
		if (index !== -1) {
			this.budgetItems.splice(index, 1);
		}
		this.saveToStorage();
	}

	updateItem(item: BudgetItem) {
		const index = this.budgetItems.findIndex((i) => i.id === item.id);
		if (index !== -1) {
			this.budgetItems[index] = item;
		}
		this.saveToStorage();
	}

	deleteItemsByType(type: BudgetItem['type'] | null = null) {
		if (!type) {
			this.budgetItems = [];
			this.saveToStorage();
			return;
		}
		this.budgetItems = this.budgetItems.filter((item) => item.type !== type);
		this.saveToStorage();
	}

	clearBudget() {
		this.budgetItems = [];
		this.categories = {
			income: [],
			expense: []
		};
		this.saveToStorage();
	}

	resetBudget() {
		this.budgetItems = defaultBudgetItems;
		this.categories = defaultCategories;
		this.saveToStorage();
	}

	getDownloadData() {
		// Sort items by type
		const income = this.budgetItems.filter((item) => item.type === 'income');
		const expenses = this.budgetItems.filter((item) => item.type === 'expense');

		const columns = [
			'Type',
			'Name',
			'Category',
			'Amount',
			'Frequency',
			'Monthly Total',
			'Annual Total'
		];
		const rows: (string | number)[][] = [];

		// Helper function to add items of a specific type
		function addItemsToRows(items: BudgetItem[], type: string) {
			if (items.length > 0) {
				// Section label (not header)
				const sectionLabel =
					type === 'expense' ? 'Expenses' : type.charAt(0).toUpperCase() + type.slice(1);
				rows.push([sectionLabel]);

				items.forEach((item) => {
					const monthlyAmount = convertToFrequency(item.amount, item.frequency, 'monthly');
					const annualAmount = convertToFrequency(item.amount, item.frequency, 'annually');

					rows.push([
						type === 'expenses' ? 'expense' : type,
						item.name,
						item.category,
						Number(item.amount.toFixed(2)),
						item.frequency,
						Number(monthlyAmount.toFixed(2)),
						Number(annualAmount.toFixed(2))
					]);
				});

				// Add total for this type
				const monthlyTotal = items.reduce(
					(acc, item) => acc + convertToFrequency(item.amount, item.frequency, 'monthly'),
					0
				);
				const annualTotal = items.reduce(
					(acc, item) => acc + convertToFrequency(item.amount, item.frequency, 'annually'),
					0
				);
				rows.push([
					`${type.charAt(0).toUpperCase() + type.slice(1)} Total`,
					'',
					'',
					'',
					'',
					Number(monthlyTotal.toFixed(2)),
					Number(annualTotal.toFixed(2))
				]);
				// Blank line after section
				rows.push([]);
			}
		}

		// Add all item types
		addItemsToRows(income, 'income');
		addItemsToRows(expenses, 'expense');

		// Calculate unallocated funds
		const monthlyincome = income.reduce(
			(acc, item) => acc + convertToFrequency(item.amount, item.frequency, 'monthly'),
			0
		);

		const monthlyexpenses = expenses.reduce(
			(acc, item) => acc + convertToFrequency(item.amount, item.frequency, 'monthly'),
			0
		);
		const monthlyUnallocated = monthlyincome - monthlyexpenses;

		const annualincome = income.reduce(
			(acc, item) => acc + convertToFrequency(item.amount, item.frequency, 'annually'),
			0
		);
		const annualexpenses = expenses.reduce(
			(acc, item) => acc + convertToFrequency(item.amount, item.frequency, 'annually'),
			0
		);

		const annualUnallocated = annualincome - annualexpenses;

		// Add summary row
		rows.push([
			'Unallocated Funds',
			'',
			'',
			'',
			'',
			Number(monthlyUnallocated.toFixed(2)),
			Number(annualUnallocated.toFixed(2))
		]);

		return {
			columns,
			rows,
			filename: `budget-${new Date().toLocaleDateString('en-AU').split('/').join('-')}.csv`
		};
	}

	saveToStorage() {
		if (!browser) return;
		const data = {
			budgetItems: this.budgetItems,
			categories: this.categories
		};
		localStorage.setItem('budget-data', JSON.stringify(data));
	}

	clearStorage() {
		localStorage.removeItem('budget-data');
	}
}

const BUDGET_KEY = Symbol('budget');

export function setBudgetState() {
	return setContext(BUDGET_KEY, new Budget());
}

export function getBudgetState() {
	return getContext<Budget>(BUDGET_KEY);
}
