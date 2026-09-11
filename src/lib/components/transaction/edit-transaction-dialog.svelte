<script lang="ts">
	import Button from '$ui/button/button.svelte';
	import * as Dialog from '$ui/dialog/index.js';
	import * as NativeSelect from '$ui/native-select/index.js';
	import Input from '$ui/input/input.svelte';
	import * as Field from '$ui/field';
	import { updateTransaction } from '#lib/remotes/transaction.remote.js';
	import Spinner from '$ui/spinner/spinner.svelte';

	let {
		transactionId,
		holdingId,
		transaction,
		open = $bindable(false)
	}: {
		transactionId: string;
		holdingId: string;
		transaction: {
			type: string;
			quantity: number;
			pricePerUnit: number;
			brokerage?: number;
			transactionDate: Date | string;
		};
		open?: boolean;
	} = $props();

	const formatDate = (date: Date | string) => new Date(date).toISOString().split('T')[0];

	const fields = updateTransaction.fields;
</script>

<Dialog.Root bind:open>
	<Dialog.Content>
		<Dialog.Header>
			<Dialog.Title>Edit Transaction</Dialog.Title>
			<Dialog.Description>Update your transaction details.</Dialog.Description>
		</Dialog.Header>

		{#each fields.allIssues?.() ?? [] as issue}
			<p class="text-sm text-destructive">{issue.message}</p>
		{/each}

		<form
			{...updateTransaction.enhance(async (form) => {
				await form.submit();
				if (form.result?.success) open = false;
			})}
			class="space-y-4"
		>
			<input type="hidden" {...fields.id.as('text')} value={transactionId} />

			<Field.Field>
				<Field.Label for="type">Transaction Type</Field.Label>
				<NativeSelect.Root id="type" {...fields.type.as('text')} value={transaction.type}>
					<NativeSelect.Option value="">Select type</NativeSelect.Option>
					<NativeSelect.Option value="buy">Buy</NativeSelect.Option>
					<NativeSelect.Option value="sell">Sell</NativeSelect.Option>
					<NativeSelect.Option value="reinvestment">Reinvestment</NativeSelect.Option>
				</NativeSelect.Root>
				<Field.Error />
			</Field.Field>

			<div class="grid grid-cols-2 gap-4">
				<Field.Field>
					<Field.Label for="quantity">Quantity</Field.Label>
					<Input
						id="quantity"
						{...fields.quantity.as('number')}
						value={transaction.quantity}
						min="1"
						step="1"
					/>
					<Field.Error />
				</Field.Field>

				<Field.Field>
					<Field.Label for="pricePerUnit">Price Per Unit</Field.Label>
					<Input
						id="pricePerUnit"
						{...fields.pricePerUnit.as('number')}
						value={transaction.pricePerUnit}
						min="0"
						step="0.01"
					/>
					<Field.Error />
				</Field.Field>
			</div>

			<Field.Field>
				<Field.Label for="brokerage">Brokerage</Field.Label>
				<Input
					id="brokerage"
					{...fields.brokerage.as('number')}
					value={transaction.brokerage || 0}
					min="0"
					step="0.01"
				/>
				<Field.Error />
			</Field.Field>

			<Field.Field>
				<Field.Label for="transactionDate">Transaction Date</Field.Label>
				<Input
					id="transactionDate"
					{...fields.transactionDate.as('date')}
					value={formatDate(transaction.transactionDate)}
				/>
				<Field.Error />
			</Field.Field>

			<div class="mt-4 flex justify-end gap-2">
				<Button type="button" variant="outline" onclick={() => (open = false)}>Cancel</Button>
				<Button type="submit" disabled={!!updateTransaction.pending}>
					{#if updateTransaction.pending}
						<Spinner class="size-4" />
					{:else}
						Save Changes
					{/if}
				</Button>
			</div>
		</form>
	</Dialog.Content>
</Dialog.Root>
