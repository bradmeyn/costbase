<script lang="ts">
	import Button from '$ui/button/button.svelte';
	import * as Table from '$ui/table';
	import { Pencil, Trash2 } from '@lucide/svelte';
	import EditTransactionDialog from '#lib/components/transaction/edit-transaction-dialog.svelte';
	import DeleteDialog from '#lib/components/delete-dialog.svelte';
	import { deleteTransaction } from '#lib/remotes/transaction.remote.js';
	import { formatCurrency } from '#lib/utils.js';

	let {
		transaction,
		holdingId
	}: {
		transaction: any;
		holdingId: string;
	} = $props();

	let editOpen = $state(false);
	let deleteOpen = $state(false);

	const formatDate = (date: Date | string) => {
		return new Date(date).toLocaleDateString('en-AU', {
			year: 'numeric',
			month: 'short',
			day: 'numeric'
		});
	};

	const TYPE_BADGES = {
		buy: { label: 'Buy', dot: 'bg-emerald-500' },
		sell: { label: 'Sell', dot: 'bg-rose-500' },
		reinvestment: { label: 'Reinvestment', dot: 'bg-sky-500' }
	} as const;

	const badge = $derived(
		TYPE_BADGES[transaction.type as keyof typeof TYPE_BADGES] ?? TYPE_BADGES.buy
	);
</script>

<Table.Row>
	<Table.Cell>{formatDate(transaction.transactionDate)}</Table.Cell>
	<Table.Cell>
		<span class="inline-flex items-center gap-2 text-sm">
			<span class="size-1.5 rounded-full {badge.dot}"></span>
			{badge.label}
		</span>
	</Table.Cell>
	<Table.Cell class="text-right">{transaction.quantity}</Table.Cell>
	<Table.Cell class="text-right">{formatCurrency(transaction.pricePerUnit)}</Table.Cell>
	<Table.Cell class="text-right">{formatCurrency(transaction.brokerage || 0)}</Table.Cell>
	<Table.Cell class="text-right">
		{formatCurrency(transaction.quantity * transaction.pricePerUnit)}
	</Table.Cell>
	<Table.Cell class="text-right">
		<div class="flex justify-end gap-2">
			<Button
				variant="ghost"
				size="icon"
				onclick={() => (editOpen = true)}
				aria-label="Edit transaction"
			>
				<Pencil class="size-4" />
			</Button>
			<Button
				variant="ghost"
				size="icon"
				onclick={() => (deleteOpen = true)}
				aria-label="Delete transaction"
			>
				<Trash2 class="size-4" />
			</Button>
		</div>
	</Table.Cell>
</Table.Row>

<!-- Edit Transaction Dialog -->
<EditTransactionDialog
	transactionId={transaction.id}
	{holdingId}
	{transaction}
	bind:open={editOpen}
/>

<!-- Delete Transaction Dialog -->
<DeleteDialog
	bind:open={deleteOpen}
	label="transaction"
	showTrigger={false}
	onDelete={async () => {
		await deleteTransaction({ id: transaction.id });
		deleteOpen = false;
	}}
/>
