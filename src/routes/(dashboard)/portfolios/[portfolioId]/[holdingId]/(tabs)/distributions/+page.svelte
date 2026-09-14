<script lang="ts">
	import { page } from '$app/state';
	import * as Table from '$ui/table';
	import Button from '$ui/button/button.svelte';
	import AddDistributionDialog from '#lib/components/distribution/add-distribution-dialog.svelte';
	import DistributionRow from '#lib/components/distribution/distribution-row.svelte';
	import { getHolding } from '#lib/remotes/holding.remote.js';

	const holdingId = $derived(page.params.holdingId!);
	const holding = $derived(await getHolding(holdingId));

	let addDistributionOpen = $state(false);
</script>

<AddDistributionDialog {holdingId} bind:open={addDistributionOpen} showTrigger={false} />

<div class="mb-4 flex items-center justify-between">
	<h2 class="text-base font-semibold">Distributions</h2>
	<Button onclick={() => (addDistributionOpen = true)}>Add Distribution</Button>
</div>

{#if holding.distributions && holding.distributions.length > 0}
	<div class="card">
		<Table.Root>
			<Table.Header>
				<Table.Row>
					<Table.Head>Date Paid</Table.Head>
					<Table.Head class="text-right">Gross</Table.Head>
					<Table.Head class="text-right">Tax Withheld</Table.Head>
					<Table.Head class="text-right">Net</Table.Head>
					<Table.Head>Reinvested</Table.Head>
					<Table.Head class="text-right">Actions</Table.Head>
				</Table.Row>
			</Table.Header>
			<Table.Body>
				{#each holding.distributions as distribution (distribution.id)}
					<DistributionRow {distribution} {holdingId} />
				{/each}
			</Table.Body>
		</Table.Root>
	</div>
{:else}
	<div class="card flex flex-col items-center justify-center py-12 text-center">
		<p class="mb-4 text-muted-foreground">
			No distributions yet. Add your first distribution to track income.
		</p>
		<Button onclick={() => (addDistributionOpen = true)}>Add Distribution</Button>
	</div>
{/if}
