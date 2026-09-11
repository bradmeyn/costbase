<script lang="ts">
	import {
		getSubscriptions,
		addSubscription,
		updateSubscription
	} from '#lib/remotes/subscription.remote.js';
	import * as Dialog from '$ui/dialog';
	import * as Field from '$ui/field';
	import * as NativeSelect from '$ui/native-select';
	import Input from '$ui/input/input.svelte';
	import { Button } from '$ui/button';
	import { FREQUENCIES, FREQUENCY_ENUM } from '#lib/constants/frequencies.js';
	import { OWNERS } from '#lib/constants/categories.js';
	import type { Subscription } from '$db/schemas/budget';

	let {
		open,
		onOpenChange,
		subscription = null
	}: {
		open: boolean;
		onOpenChange: (open: boolean) => void;
		/** When set, the dialog edits this subscription; otherwise it adds a new one. */
		subscription?: Subscription | null;
	} = $props();

	function toDateInputValue(date: Date | string) {
		return new Date(date).toISOString().split('T')[0];
	}
</script>

<Dialog.Root {open} {onOpenChange}>
	<Dialog.Content>
		<Dialog.Header>
			<Dialog.Title>{subscription ? 'Edit Subscription' : 'Add Subscription'}</Dialog.Title>
		</Dialog.Header>

		{#if subscription}
			{#each updateSubscription.fields.issues() as issue}
				<p class="text-sm text-destructive">{issue.message}</p>
			{/each}
			<form
				{...updateSubscription.enhance(async (form) => {
					await form.submit().updates(getSubscriptions());
					if (form.result?.success) {
						form.element.reset();
						onOpenChange(false);
					}
				})}
				class="space-y-4"
			>
				<input {...updateSubscription.fields.id.as('text')} type="hidden" value={subscription.id} />

				<Field.Field>
					<Field.Label for="edit-name">Name</Field.Label>
					<Input
						id="edit-name"
						{...updateSubscription.fields.name.as('text')}
						value={subscription.name}
					/>
					<Field.Error />
				</Field.Field>

				<div class="grid grid-cols-2 gap-3">
					<Field.Field>
						<Field.Label for="edit-amount">Amount ($)</Field.Label>
						<Input
							id="edit-amount"
							{...updateSubscription.fields.amount.as('text')}
							inputmode="decimal"
							value={subscription.amount / 100}
						/>
						<Field.Error />
					</Field.Field>

					<Field.Field>
						<Field.Label>Frequency</Field.Label>
						<NativeSelect.Root
							{...updateSubscription.fields.frequency.as('text')}
							value={subscription.frequency}
						>
							{#each FREQUENCY_ENUM as f}
								<NativeSelect.Option value={f}>{FREQUENCIES[f].label}</NativeSelect.Option>
							{/each}
						</NativeSelect.Root>
					</Field.Field>
				</div>

				<Field.Field>
					<Field.Label for="edit-dueDate">Next Due Date</Field.Label>
					<Input
						id="edit-dueDate"
						{...updateSubscription.fields.nextDueDate.as('date')}
						value={toDateInputValue(subscription.nextDueDate)}
					/>
					<Field.Error />
				</Field.Field>

				<Field.Field>
					<Field.Label>Owner</Field.Label>
					<NativeSelect.Root
						{...updateSubscription.fields.owner.as('text')}
						value={subscription.owner ?? OWNERS[2]}
					>
						{#each OWNERS as owner}
							<NativeSelect.Option value={owner}>{owner}</NativeSelect.Option>
						{/each}
					</NativeSelect.Root>
					<Field.Error />
				</Field.Field>

				<input type="hidden" name="category" value={subscription.category ?? 'Entertainment'} />

				<div class="flex justify-end gap-2">
					<Button type="button" variant="outline" onclick={() => onOpenChange(false)}>Cancel</Button
					>
					<Button type="submit" disabled={!!updateSubscription.pending}>Save</Button>
				</div>
			</form>
		{:else}
			{#each addSubscription.fields.issues() as issue}
				<p class="text-sm text-destructive">{issue.message}</p>
			{/each}
			<form
				{...addSubscription.enhance(async (form) => {
					await form.submit().updates(getSubscriptions());
					if (form.result?.success) {
						form.element.reset();
						onOpenChange(false);
					}
				})}
				class="space-y-4"
			>
				<Field.Field>
					<Field.Label for="name">Name</Field.Label>
					<Input
						id="name"
						{...addSubscription.fields.name.as('text')}
						placeholder="e.g., Netflix"
					/>
					<Field.Error />
				</Field.Field>

				<div class="grid grid-cols-2 gap-3">
					<Field.Field>
						<Field.Label for="amount">Amount ($)</Field.Label>
						<Input
							id="amount"
							{...addSubscription.fields.amount.as('text')}
							inputmode="decimal"
							placeholder="0.00"
						/>
						<Field.Error />
					</Field.Field>

					<Field.Field>
						<Field.Label>Frequency</Field.Label>
						<NativeSelect.Root {...addSubscription.fields.frequency.as('text')} value="monthly">
							{#each FREQUENCY_ENUM as f}
								<NativeSelect.Option value={f}>{FREQUENCIES[f].label}</NativeSelect.Option>
							{/each}
						</NativeSelect.Root>
					</Field.Field>
				</div>

				<Field.Field>
					<Field.Label for="nextDueDate">Next Due Date</Field.Label>
					<Input id="nextDueDate" {...addSubscription.fields.nextDueDate.as('date')} />
					<Field.Error />
				</Field.Field>

				<Field.Field>
					<Field.Label>Owner</Field.Label>
					<NativeSelect.Root {...addSubscription.fields.owner.as('text')} value={OWNERS[2]}>
						{#each OWNERS as owner}
							<NativeSelect.Option value={owner}>{owner}</NativeSelect.Option>
						{/each}
					</NativeSelect.Root>
					<Field.Error />
				</Field.Field>

				<input type="hidden" name="category" value="Entertainment" />

				<div class="flex justify-end gap-2">
					<Button type="button" variant="outline" onclick={() => onOpenChange(false)}>Cancel</Button
					>
					<Button type="submit" disabled={!!addSubscription.pending}>Add</Button>
				</div>
			</form>
		{/if}
	</Dialog.Content>
</Dialog.Root>
