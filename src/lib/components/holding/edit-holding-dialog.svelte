<script lang="ts">
	import Button from '$ui/button/button.svelte';
	import * as Dialog from '$ui/dialog/index.js';
	import * as Field from '$ui/field';
	import { updateHolding } from '#lib/remotes/holding.remote.js';
	import { getHolding, getHoldings } from '#lib/remotes/holding.remote.js';
	import { getPortfolio } from '#lib/remotes/portfolio.remote.js';
	import { getInvestments } from '#lib/remotes/investment.remote.js';
	import Spinner from '$ui/spinner/spinner.svelte';

	let {
		holdingId,
		portfolioId,
		holding,
		open,
		onOpenChange
	}: {
		holdingId: string;
		portfolioId: string;
		holding: {
			investmentId: string;
		};
		open: boolean;
		onOpenChange: (open: boolean) => void;
	} = $props();

	const investments = $derived(await getInvestments());
</script>

<Dialog.Root {open} {onOpenChange}>
	<Dialog.Content>
		<Dialog.Header>
			<Dialog.Title>Edit Holding</Dialog.Title>
			<Dialog.Description>Update your holding details.</Dialog.Description>
		</Dialog.Header>

		{#each updateHolding.fields.issues() as issue, i (i)}
			<p class="text-sm text-loss">{issue.message}</p>
		{/each}

		<form
			{...updateHolding.for(holdingId).enhance(async (form) => {
				try {
					await form
						.submit()
						.updates(getHolding(holdingId), getHoldings(portfolioId), getPortfolio(portfolioId));
					if (form.result?.success) {
						onOpenChange(false);
					}
				} catch (e) {
					console.error('Error editing holding', e);
				}
			})}
			class="space-y-4"
		>
			<Field.Field>
				<Field.Label for="investmentId">Investment</Field.Label>
				<select
					id="investmentId"
					{...updateHolding.fields.investmentId.as('text')}
					value={holding.investmentId}
					class="w-full rounded-md border border-input bg-background px-3 py-2"
				>
					<option value="">Select an investment</option>
					{#each investments as investment (investment.id)}
						<option value={investment.id}>
							{investment.name} ({investment.code})
						</option>
					{/each}
				</select>
				<Field.Error />
			</Field.Field>

			<input type="hidden" name="id" value={holdingId} />

			<div class="mt-4 flex justify-end gap-2">
				<Button type="button" variant="outline" onclick={() => onOpenChange(false)}>Cancel</Button>
				<Button type="submit" disabled={!!updateHolding.pending}>
					{#if updateHolding.pending}
						<Spinner class="size-4" />
					{:else}
						Save Changes
					{/if}
				</Button>
			</div>
		</form>
	</Dialog.Content>
</Dialog.Root>
