<script lang="ts">
	import Button, { buttonVariants } from '$ui/button/button.svelte';
	import * as Dialog from '$ui/dialog/index.js';
	import * as Field from '$ui/field';
	import { addHolding } from '#lib/remotes/holding.remote.js';
	import { getHoldings } from '#lib/remotes/holding.remote.js';
	import { getPortfolio } from '#lib/remotes/portfolio.remote.js';
	import { getInvestments } from '#lib/remotes/investment.remote.js';
	import Spinner from '$ui/spinner/spinner.svelte';
	import { Plus } from '@lucide/svelte';

	let {
		portfolioId,
		open = $bindable(false),
		showTrigger = true
	}: {
		portfolioId: string;
		open?: boolean;
		showTrigger?: boolean;
	} = $props();

	const investments = $derived(await getInvestments());
</script>

<Dialog.Root bind:open>
	{#if showTrigger}
		<Dialog.Trigger
			class={buttonVariants({ variant: 'default' }) + ' flex items-center gap-2'}
			aria-label="Add holding"
		>
			<Plus />
			<span>Add Holding</span>
		</Dialog.Trigger>
	{/if}

	<Dialog.Content>
		<Dialog.Header>
			<Dialog.Title>Add Holding</Dialog.Title>
			<Dialog.Description>Add a new stock or asset to your portfolio.</Dialog.Description>
		</Dialog.Header>

		{#each addHolding.fields.issues() as issue, i (i)}
			<p class="text-sm text-loss">{issue.message}</p>
		{/each}

		<form
			{...addHolding.for(portfolioId).enhance(async (form) => {
				try {
					await form.submit().updates(getHoldings(portfolioId), getPortfolio(portfolioId));
					if (form.result?.success) {
						form.element.reset();
						open = false;
					}
				} catch (e) {
					console.error('Error adding holding', e);
				}
			})}
			class="space-y-4"
		>
			<Field.Field>
				<Field.Label for="investmentId">Investment</Field.Label>
				<select
					id="investmentId"
					{...addHolding.fields.investmentId.as('text')}
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

			<input {...addHolding.for(portfolioId).fields.portfolioId.as('hidden', portfolioId)} />

			<div class="mt-4 flex justify-end gap-2">
				<Button type="button" variant="outline" onclick={() => (open = false)}>Cancel</Button>
				<Button type="submit" disabled={!!addHolding.pending}>
					{#if addHolding.pending}
						<Spinner class="size-4" />
					{:else}
						Add Holding
					{/if}
				</Button>
			</div>
		</form>
	</Dialog.Content>
</Dialog.Root>
