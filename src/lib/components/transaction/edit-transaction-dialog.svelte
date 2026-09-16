<script lang="ts">
	import Button from '$ui/button/button.svelte';
	import * as Dialog from '$ui/dialog/index.js';
	import * as Select from '$ui/select/index.js';
	import Input from '$ui/input/input.svelte';
	import * as Field from '$ui/field';
	import { updateTransaction } from '#lib/remotes/transaction.remote.js';
	import Spinner from '$ui/spinner/spinner.svelte';
	import { Trash2 } from '@lucide/svelte';
	import { PLATFORMS } from '#lib/platforms.js';
	import DocumentAttachment from '#lib/components/document-attachment.svelte';
	import type { Document } from '$db/schemas/portfolio';

	let {
		transactionId,
		transaction,
		open = $bindable(false),
		onDelete
	}: {
		/** Removing the transaction, offered at the foot of the form it belongs to. */
		onDelete?: () => void;
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

	/*
	  The select is a bits-ui listbox rather than a native one, so its value is held
	  here and submitted through the hidden input the component renders for `name`.
	*/
	const TRANSACTION_TYPES = [
		{ value: 'buy', label: 'Buy' },
		{ value: 'sell', label: 'Sell' },
		{ value: 'reinvestment', label: 'Reinvestment' }
	];
	// Seeded from the row by the effect below, so reopening the dialog starts fresh.
	let type = $state('');
	let platform = $state('');
	$effect(() => {
		type = transaction.type;
		platform = transaction.platform ?? '';
	});
	const typeLabel = $derived(
		TRANSACTION_TYPES.find((t) => t.value === type)?.label ?? 'Select type'
	);
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
				<Select.Root type="single" name={fields.type.as('text').name} bind:value={type}>
					<Select.Trigger id="type" class="w-full">{typeLabel}</Select.Trigger>
					<Select.Content>
						{#each TRANSACTION_TYPES as option (option.value)}
							<Select.Item value={option.value}>{option.label}</Select.Item>
						{/each}
					</Select.Content>
				</Select.Root>
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
				<Select.Root type="single" name={fields.platform.as('text').name} bind:value={platform}>
					<Select.Trigger id="platform" class="w-full">
						{platform || 'Not recorded'}
					</Select.Trigger>
					<Select.Content>
						<Select.Item value="">Not recorded</Select.Item>
						{#each PLATFORMS as option (option)}
							<Select.Item value={option}>{option}</Select.Item>
						{/each}
					</Select.Content>
				</Select.Root>
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

			<div class="mt-4 flex items-center gap-2 border-t border-border pt-4">
				{#if onDelete}
					<Button
						type="button"
						variant="ghost"
						class="text-destructive hover:bg-destructive/10 hover:text-destructive"
						onclick={onDelete}
					>
						<Trash2 class="size-4" />
						Delete transaction
					</Button>
				{/if}
				<div class="ml-auto flex gap-2">
					<Button type="button" variant="outline" onclick={() => (open = false)}>Cancel</Button>
					<Button type="submit" disabled={!!updateTransaction.pending}>
						{#if updateTransaction.pending}
							<Spinner class="size-4" />
						{:else}
							Save Changes
						{/if}
					</Button>
				</div>
			</div>
		</form>
	</Dialog.Content>
</Dialog.Root>
