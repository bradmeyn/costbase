<script lang="ts">
	import Button from '$ui/button/button.svelte';
	import * as Dialog from '$ui/dialog/index.js';
	import * as NativeSelect from '$ui/native-select/index.js';
	import Input from '$ui/input/input.svelte';
	import * as Field from '$ui/field';
	import { updateTransaction } from '#lib/remotes/transaction.remote.js';
	import Spinner from '$ui/spinner/spinner.svelte';
	import DocumentAttachment from '#lib/components/document-attachment.svelte';
	import type { Document } from '$db/schemas/portfolio';

	let {
		transactionId,
		transaction,
		open = $bindable(false)
	}: {
		transactionId: string;
		transaction: {
			type: string;
			quantity: number;
			pricePerUnit: number;
			brokerage?: number;
			platform?: string | null;
			documents?: Document[];
			transactionDate: Date | string;
		};
		open?: boolean;
	} = $props();

	/*
	  Amounts are stored in cents but the form is filled in dollars — the same units a
	  person reads off the note — so they are converted on the way in as well as out.
	*/
	const formatDate = (date: Date | string) => new Date(date).toISOString().split('T')[0];

	const fields = updateTransaction.fields;
</script>

<Dialog.Root bind:open>
	<Dialog.Content>
		<Dialog.Header>
			<Dialog.Title>Edit Transaction</Dialog.Title>
			<Dialog.Description>Update your transaction details.</Dialog.Description>
		</Dialog.Header>

		{#each fields.allIssues?.() ?? [] as issue, i (i)}
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
						{...fields.quantity.as('number', transaction.quantity)}
						min="1"
						step="1"
					/>
					<Field.Error />
				</Field.Field>

				<Field.Field>
					<Field.Label for="pricePerUnit">Price Per Unit</Field.Label>
					<Input
						id="pricePerUnit"
						{...fields.pricePerUnit.as('number', transaction.pricePerUnit / 100)}
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
					{...fields.brokerage.as('number', (transaction.brokerage ?? 0) / 100)}
					min="0"
					step="0.01"
				/>
				<Field.Error />
			</Field.Field>

			<Field.Field>
				<Field.Label>Document</Field.Label>
				<div class="flex items-center gap-1">
					<DocumentAttachment
						owner="transaction"
						ownerId={transactionId}
						documents={transaction.documents}
					/>
					<span class="text-[13px] text-muted-foreground">
						{transaction.documents?.[0]?.filename ?? 'No contract note attached'}
					</span>
				</div>
			</Field.Field>

			<Field.Field>
				<Field.Label for="platform">Platform</Field.Label>
				<Input
					id="platform"
					{...fields.platform.as('text', transaction.platform ?? '')}
					placeholder="Stake, CommSec, …"
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
