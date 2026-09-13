<script lang="ts">
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import * as Table from '$ui/table';
	import Button from '$ui/button/button.svelte';
	import AddTransactionsDialog from '#lib/components/transaction/add-transactions-dialog.svelte';
	import TransactionRow from '#lib/components/transaction/transaction-row.svelte';
	import { getHolding } from '#lib/remotes/holding.remote.js';

	const holdingId = $derived(page.params.holdingId!);
	const portfolioId = $derived(page.params.portfolioId!);
	const holding = $derived(await getHolding(holdingId));

	let addTransactionsOpen = $state(false);
</script>

<AddTransactionsDialog {holdingId} bind:open={addTransactionsOpen} showTrigger={false} />

<div class="mb-4 flex items-center justify-between">
	<h2 class="text-base font-semibold">Transactions</h2>
	<div class="flex items-center gap-2">
		<Button
			variant="ghost"
			href={resolve('/(dashboard)/portfolios/[portfolioId]/import', { portfolioId })}
		>
			Import a document
		</Button>
		<Button onclick={() => (addTransactionsOpen = true)}>Add Transactions</Button>
	</div>
</div>

{#if holding.transactions.length > 0}
	<div class="card">
		<Table.Root>
			<Table.Header>
				<Table.Row>
					<Table.Head>Date</Table.Head>
					<Table.Head>Type</Table.Head>
					<Table.Head class="text-right">Quantity</Table.Head>
					<Table.Head class="text-right">Price per Unit</Table.Head>
					<Table.Head class="text-right">Brokerage</Table.Head>
					<Table.Head class="text-right">Total</Table.Head>
					<Table.Head class="text-right">Actions</Table.Head>
				</Table.Row>
			</Table.Header>
			<Table.Body>
				{#each holding.transactions as transaction (transaction.id)}
					<TransactionRow {transaction} />
				{/each}
			</Table.Body>
		</Table.Root>
	</div>
{:else}
	<div class="card flex flex-col items-center justify-center py-12 text-center">
		<p class="mb-4 text-muted-foreground">
			No transactions yet. Add your first transaction to get started.
		</p>
		<Button onclick={() => (addTransactionsOpen = true)}>Add Transactions</Button>
	</div>
{/if}
