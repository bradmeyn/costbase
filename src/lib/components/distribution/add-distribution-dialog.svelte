<script lang="ts">
	import Button, { buttonVariants } from '$ui/button/button.svelte';
	import * as Dialog from '$ui/dialog/index.js';
	import Input from '$ui/input/input.svelte';
	import * as Field from '$ui/field';
	import { addDistribution } from '#lib/remotes/distribution.remote.js';
	import Spinner from '$ui/spinner/spinner.svelte';
	import { Plus } from '@lucide/svelte';
	import { Checkbox } from '$ui/checkbox';
	import Label from '$ui/label/label.svelte';
	import { formatCurrency } from '#lib/utils.js';

	let {
		holdingId,
		open = $bindable(false),
		showTrigger = true
	}: {
		holdingId: string;
		open?: boolean;
		showTrigger?: boolean;
	} = $props();

	const fields = addDistribution.fields;
	let netPayment = $derived(
		((Number(fields.grossPayment.value()) || 0) - (Number(fields.taxWithheld.value()) || 0)) * 100
	);
</script>

<Dialog.Root bind:open>
	{#if showTrigger}
		<Dialog.Trigger class={buttonVariants({ variant: 'default' })}>
			<Plus class="mr-2 size-4" />
			Add Distribution
		</Dialog.Trigger>
	{/if}

	<Dialog.Content class="max-w-md">
		<Dialog.Header>
			<Dialog.Title>Add Distribution</Dialog.Title>
			<Dialog.Description>Record a distribution payment for this holding.</Dialog.Description>
		</Dialog.Header>

		{#each fields.allIssues?.() ?? [] as issue, i (i)}
			<p class="text-sm text-destructive">{issue.message}</p>
		{/each}

		<form
			{...addDistribution.enhance(async (form) => {
				await form.submit();
				if (form.result?.success) {
					form.element.reset();
					open = false;
				}
			})}
			class="space-y-4"
		>
			<input type="hidden" {...fields.holdingId.as('text')} value={holdingId} />

			<Field.Field>
				<Field.Label for="datePaid">Date Paid</Field.Label>
				<Input id="datePaid" {...fields.datePaid.as('date')} />
				<Field.Error />
			</Field.Field>

			<div class="grid grid-cols-2 gap-4">
				<Field.Field>
					<Field.Label for="grossPayment">Gross Payment</Field.Label>
					<Input id="grossPayment" {...fields.grossPayment.as('number')} min="0" step="0.01" />
					<Field.Error />
				</Field.Field>

				<Field.Field>
					<Field.Label for="taxWithheld">Tax Withheld</Field.Label>
					<Input id="taxWithheld" {...fields.taxWithheld.as('number')} min="0" step="0.01" />
					<Field.Error />
				</Field.Field>
			</div>

			<div class="rounded-lg bg-muted/50 p-4">
				<p class="text-sm text-muted-foreground">Net Payment</p>
				<p class="text-lg font-semibold">{formatCurrency(netPayment)}</p>
			</div>

			<div class="flex items-center gap-2 rounded-lg border p-4">
				<Checkbox id="reinvested" name="reinvested" value="on" />
				<Label for="reinvested">Distribution Reinvested (DRP)</Label>
			</div>

			<div class="flex justify-end gap-2 pt-4">
				<Button type="button" variant="outline" onclick={() => (open = false)}>Cancel</Button>
				<Button type="submit" disabled={!!addDistribution.pending}>
					{#if addDistribution.pending}
						<Spinner class="size-4" />
					{:else}
						Add Distribution
					{/if}
				</Button>
			</div>
		</form>
	</Dialog.Content>
</Dialog.Root>
