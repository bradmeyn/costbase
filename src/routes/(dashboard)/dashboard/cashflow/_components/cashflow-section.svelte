<script lang="ts">
	import * as Table from '$ui/table';
	import { Button } from '$ui/button';
	import { Plus } from '@lucide/svelte';
	import RowActionsMenu from '#lib/components/row-actions-menu.svelte';
	import { formatCurrency } from '#lib/utils/formatters.js';
	import { convertFrequency, formatFrequency } from '#lib/utils/cashflow.js';
	import { FREQUENCIES, type FrequencyType } from '#lib/constants/frequencies.js';
	import type { BudgetItem } from '$db/schemas/budget';
	import type { Snippet } from 'svelte';

	let {
		title,
		addLabel,
		items,
		amountClass,
		emptyMessage,
		isEmpty,
		displayPeriod,
		onAdd,
		onEdit,
		onDelete,
		extra
	}: {
		title: string;
		addLabel: string;
		items: BudgetItem[];
		/** Tailwind class for the monthly amount cell, e.g. text-emerald-600. */
		amountClass: string;
		emptyMessage: string;
		/** Whether to show the empty-state row (lets the parent fold in extra rows). */
		isEmpty: boolean;
		/** Frequency the amount column is normalised to. */
		displayPeriod: FrequencyType;
		onAdd: () => void;
		onEdit: (item: BudgetItem) => void;
		onDelete: (item: BudgetItem) => void;
		/** Extra rows rendered after the items, e.g. a subscriptions summary row. */
		extra?: Snippet;
	} = $props();

	const dollars = (cents: number) => cents / 100;
</script>

<div class="space-y-3">
	<div class="flex items-center justify-between">
		<h2 class="font-medium">{title}</h2>
		<Button size="sm" variant="outline" onclick={onAdd}>
			<Plus class="mr-1 size-3.5" />
			{addLabel}
		</Button>
	</div>

	<div class="card p-0">
		<Table.Root>
			<Table.Header>
				<Table.Row>
					<Table.Head>Name</Table.Head>
					<Table.Head>Category</Table.Head>
					<Table.Head>Frequency</Table.Head>
					<Table.Head class="text-right">{FREQUENCIES[displayPeriod].label}</Table.Head>
					<Table.Head class="w-10"></Table.Head>
				</Table.Row>
			</Table.Header>
			<Table.Body>
				{#each items as item (item.id)}
					<Table.Row>
						<Table.Cell class="font-medium">{item.name}</Table.Cell>
						<Table.Cell class="text-muted-foreground">{item.category}</Table.Cell>
						<Table.Cell>{formatFrequency(item.frequency)}</Table.Cell>
						<Table.Cell class="text-right tabular-nums {amountClass}">
							{formatCurrency(
								convertFrequency(dollars(item.amount), item.frequency, displayPeriod)
							)}
						</Table.Cell>
						<Table.Cell class="text-right">
							<RowActionsMenu
								label={item.name}
								onEdit={() => onEdit(item)}
								onDelete={() => onDelete(item)}
							/>
						</Table.Cell>
					</Table.Row>
				{/each}

				{@render extra?.()}

				{#if isEmpty}
					<Table.Row>
						<Table.Cell colspan={5} class="py-6 text-center text-muted-foreground">
							{emptyMessage}
						</Table.Cell>
					</Table.Row>
				{/if}
			</Table.Body>
		</Table.Root>
	</div>
</div>
