<script lang="ts">
	import { getBudgetItems, deleteBudgetItem } from '#lib/remotes/budget-item.remote.js';
	import { getSubscriptions } from '#lib/remotes/subscription.remote.js';
	import { formatCurrency } from '#lib/utils/formatters.js';
	import { convertFrequency } from '#lib/utils/cashflow.js';
	import * as Table from '$ui/table';
	import * as Tabs from '$ui/tabs';
	import TabSelect from '#lib/components/inputs/tab-select.svelte';
	import DeleteDialog from '#lib/components/delete-dialog.svelte';
	import BudgetItemDialog from './_components/budget-item-dialog.svelte';
	import CashflowSection from './_components/cashflow-section.svelte';
	import { OWNERS } from '#lib/constants/categories.js';
	import { FREQUENCIES, type FrequencyType } from '#lib/constants/frequencies.js';
	import type { BudgetItem } from '$db/schemas/budget';

	const [budgetItems, subscriptions] = $derived(
		await Promise.all([getBudgetItems(), getSubscriptions()])
	);

	// Owner filter — "All" plus each owner (Brad / Emily / Joint)
	const owners = ['All', ...OWNERS];
	let ownerFilter = $state('All');

	// Display period — the frequency every amount is normalised to.
	let displayPeriod = $state<FrequencyType>('monthly');
	const periodOptions = [
		{ value: 'weekly', label: 'Weekly' },
		{ value: 'fortnightly', label: 'Fortnightly' },
		{ value: 'monthly', label: 'Monthly' },
		{ value: 'annually', label: 'Annually' }
	];

	const income = $derived(
		budgetItems.filter((i) => i.type === 'income' && i.owner === ownerFilter)
	);
	const expenses = $derived(
		budgetItems.filter((i) => i.type === 'expense' && i.owner === ownerFilter)
	);

	const filteredSubscriptions = $derived(subscriptions.filter((s) => s.owner === ownerFilter));
	const showSubscriptions = $derived(filteredSubscriptions.length > 0);
	const periodSubscriptions = $derived(
		filteredSubscriptions.reduce(
			(s, sub) => s + convertFrequency(sub.amount / 100, sub.frequency, displayPeriod),
			0
		)
	);

	type Dialog =
		| { kind: 'add'; type: 'income' | 'expense' }
		| { kind: 'edit'; item: BudgetItem }
		| { kind: 'delete'; item: BudgetItem }
		| null;

	let dialog = $state<Dialog>(null);
</script>

<svelte:head><title>Cashflow | MoneyKit</title></svelte:head>

<svelte:boundary>
	{#snippet pending()}
		<div class="space-y-4">
			{#each [1, 2, 3] as _}<div class="h-20 animate-pulse rounded-2xl bg-muted/60"></div>{/each}
		</div>
	{/snippet}

	<div class="space-y-6">
		<div class="flex flex-wrap items-end justify-between gap-4">
			<div>
				<h1 class="heading-primary">Cashflow</h1>
				<p class="mt-1 text-sm text-muted-foreground">
					{FREQUENCIES[displayPeriod].label} income vs expenses.
				</p>
			</div>
			<Tabs.Root bind:value={ownerFilter}>
				<Tabs.List>
					{#each owners as owner}
						<Tabs.Trigger value={owner}>{owner}</Tabs.Trigger>
					{/each}
				</Tabs.List>
			</Tabs.Root>
		</div>

		<div class="max-w-md">
			<TabSelect bind:value={displayPeriod} name="cashflow-period" options={periodOptions} />
		</div>

		<div class="grid gap-6 lg:grid-cols-2">
			<CashflowSection
				title="Income"
				addLabel="Add Income"
				items={income}
				amountClass="text-emerald-600"
				emptyMessage="No income added yet."
				isEmpty={income.length === 0}
				{displayPeriod}
				onAdd={() => (dialog = { kind: 'add', type: 'income' })}
				onEdit={(item) => (dialog = { kind: 'edit', item })}
				onDelete={(item) => (dialog = { kind: 'delete', item })}
			/>

			<CashflowSection
				title="Expenses"
				addLabel="Add Expense"
				items={expenses}
				amountClass="text-red-500"
				emptyMessage="No expenses added yet."
				isEmpty={expenses.length === 0 && !showSubscriptions}
				{displayPeriod}
				onAdd={() => (dialog = { kind: 'add', type: 'expense' })}
				onEdit={(item) => (dialog = { kind: 'edit', item })}
				onDelete={(item) => (dialog = { kind: 'delete', item })}
			>
				{#snippet extra()}
					{#if showSubscriptions}
						<Table.Row class="bg-muted/30">
							<Table.Cell class="font-medium">Subscriptions</Table.Cell>
							<Table.Cell class="text-muted-foreground">
								{filteredSubscriptions.length} active
							</Table.Cell>
							<Table.Cell class="text-muted-foreground"
								>{FREQUENCIES[displayPeriod].label}</Table.Cell
							>
							<Table.Cell class="text-right tabular-nums text-red-500">
								{formatCurrency(periodSubscriptions)}
							</Table.Cell>
							<Table.Cell class="text-right">
								<a
									href="/dashboard/subscriptions"
									class="text-xs text-muted-foreground hover:text-foreground"
								>
									Manage →
								</a>
							</Table.Cell>
						</Table.Row>
					{/if}
				{/snippet}
			</CashflowSection>
		</div>
	</div>
</svelte:boundary>

<BudgetItemDialog
	type="income"
	open={dialog?.kind === 'add' && dialog.type === 'income'}
	onOpenChange={(o) => (dialog = o ? { kind: 'add', type: 'income' } : null)}
/>
<BudgetItemDialog
	type="expense"
	open={dialog?.kind === 'add' && dialog.type === 'expense'}
	onOpenChange={(o) => (dialog = o ? { kind: 'add', type: 'expense' } : null)}
/>

{#if dialog?.kind === 'edit'}
	<BudgetItemDialog
		type={dialog.item.type as 'income' | 'expense'}
		item={dialog.item}
		open
		onOpenChange={(o) => !o && (dialog = null)}
	/>
{/if}

<DeleteDialog
	open={dialog?.kind === 'delete'}
	onOpenChange={(o) => !o && (dialog = null)}
	showTrigger={false}
	label={dialog?.kind === 'delete' ? dialog.item.name : 'item'}
	onDelete={async () => {
		if (dialog?.kind === 'delete') {
			await deleteBudgetItem({ id: dialog.item.id });
			dialog = null;
		}
	}}
/>
