<script lang="ts">
	import Button from '$ui/button/button.svelte';
	import * as Dialog from '$ui/dialog/index.js';
	import Input from '$ui/input/input.svelte';
	import * as Field from '$ui/field';
	import { updateDistribution } from '#lib/remotes/distribution.remote.js';
	import Spinner from '$ui/spinner/spinner.svelte';
	import { Checkbox } from '$ui/checkbox';
	import Label from '$ui/label/label.svelte';
	import { formatCurrency } from '#lib/utils.js';
	import type { distributionTable } from '#lib/server/db/schemas/portfolio.js';
	import type { InferSelectModel } from 'drizzle-orm';

	type Distribution = InferSelectModel<typeof distributionTable>;

	let {
		distribution,
		holdingId,
		open = $bindable(false)
	}: {
		distribution: Distribution;
		holdingId: string;
		open?: boolean;
	} = $props();

	function toDateInputValue(date: Date | string | null) {
		if (!date) return '';
		return new Date(date).toISOString().split('T')[0];
	}

	const fields = updateDistribution.fields;
	let netPayment = $derived(
		((Number(fields.grossPayment.value() ?? distribution.grossPayment / 100) || 0) -
			(Number(fields.taxWithheld.value() ?? distribution.taxWithheld / 100) || 0)) *
			100
	);
</script>

<Dialog.Root bind:open>
	<Dialog.Content class="max-w-md">
		<Dialog.Header>
			<Dialog.Title>Edit Distribution</Dialog.Title>
			<Dialog.Description>Update the distribution details.</Dialog.Description>
		</Dialog.Header>

		{#each fields.allIssues?.() ?? [] as issue}
			<p class="text-sm text-destructive">{issue.message}</p>
		{/each}

		<form
			{...updateDistribution.enhance(async (form) => {
				await form.submit();
				if (form.result?.success) open = false;
			})}
			class="space-y-4"
		>
			<input type="hidden" {...fields.id.as('text')} value={distribution.id} />
			<input type="hidden" {...fields.holdingId.as('text')} value={holdingId} />

			<Field.Field>
				<Field.Label for="datePaid">Date Paid</Field.Label>
				<Input
					id="datePaid"
					{...fields.datePaid.as('date')}
					value={toDateInputValue(distribution.datePaid)}
				/>
				<Field.Error />
			</Field.Field>

			<div class="grid grid-cols-2 gap-4">
				<Field.Field>
					<Field.Label for="grossPayment">Gross Payment</Field.Label>
					<Input
						id="grossPayment"
						{...fields.grossPayment.as('number')}
						min="0"
						step="0.01"
						value={distribution.grossPayment / 100}
					/>
					<Field.Error />
				</Field.Field>

				<Field.Field>
					<Field.Label for="taxWithheld">Tax Withheld</Field.Label>
					<Input
						id="taxWithheld"
						{...fields.taxWithheld.as('number')}
						min="0"
						step="0.01"
						value={distribution.taxWithheld / 100}
					/>
					<Field.Error />
				</Field.Field>
			</div>

			<div class="rounded-lg bg-muted/50 p-4">
				<p class="text-sm text-muted-foreground">Net Payment</p>
				<p class="text-lg font-semibold">{formatCurrency(netPayment)}</p>
			</div>

			<div class="flex items-center gap-2 rounded-lg border p-4">
				<Checkbox id="reinvested" name="reinvested" value="on" checked={distribution.reinvested} />
				<Label for="reinvested">Distribution Reinvested (DRP)</Label>
			</div>

			<div class="flex justify-end gap-2 pt-4">
				<Button type="button" variant="outline" onclick={() => (open = false)}>Cancel</Button>
				<Button type="submit" disabled={!!updateDistribution.pending}>
					{#if updateDistribution.pending}
						<Spinner class="size-4" />
					{:else}
						Save Changes
					{/if}
				</Button>
			</div>
		</form>
	</Dialog.Content>
</Dialog.Root>
