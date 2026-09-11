<script lang="ts">
	import Button, { buttonVariants } from '$ui/button/button.svelte';
	import * as Dialog from '$ui/dialog/index.js';
	import Input from '$ui/input/input.svelte';
	import * as Field from '$ui/field';
	import { addPortfolio } from '#lib/remotes/portfolio.remote.js';
	import { getPortfolios } from '#lib/remotes/portfolio.remote.js';
	import Spinner from '$ui/spinner/spinner.svelte';
	import { Plus } from '@lucide/svelte';

	let {
		open = $bindable(false),
		showTrigger = true
	}: {
		open?: boolean;
		showTrigger?: boolean;
	} = $props();
</script>

<Dialog.Root bind:open>
	{#if showTrigger}
		<Dialog.Trigger class={buttonVariants({ variant: 'default' })} aria-label="Add portfolio">
			<Plus class="mr-2 size-4" />
			Add Portfolio
		</Dialog.Trigger>
	{/if}

	<Dialog.Content>
		<Dialog.Header>
			<Dialog.Title>Add Portfolio</Dialog.Title>
			<Dialog.Description>Create a new portfolio to track your investments.</Dialog.Description>
		</Dialog.Header>

		{#each addPortfolio.fields.issues() as issue}
			<p class="text-sm text-red-600">{issue.message}</p>
		{/each}

		<form
			{...addPortfolio.enhance(async (form) => {
				try {
					await form.submit().updates(getPortfolios());
					if (form.result?.success) {
						form.element.reset();
						open = false;
					}
				} catch (e) {
					console.error('Error adding portfolio', e);
				}
			})}
			class="space-y-4"
		>
			<Field.Field>
				<Field.Label for="name">Portfolio Name</Field.Label>
				<Input
					id="name"
					{...addPortfolio.fields.name.as('text')}
					autocomplete="off"
					placeholder="e.g., Growth Portfolio"
				/>
				<Field.Error />
			</Field.Field>

			<div class="mt-4 flex justify-end gap-2">
				<Button type="button" variant="outline" onclick={() => (open = false)}>Cancel</Button>
				<Button type="submit" disabled={!!addPortfolio.pending}>
					{#if addPortfolio.pending}
						<Spinner class="size-4" />
					{:else}
						Add Portfolio
					{/if}
				</Button>
			</div>
		</form>
	</Dialog.Content>
</Dialog.Root>
