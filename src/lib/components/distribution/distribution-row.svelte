<script lang="ts">
	import * as Table from '$ui/table';
	import Button from '$ui/button/button.svelte';
	import { CircleCheck, Pencil, Trash2 } from '@lucide/svelte';
	import { formatCurrency } from '#lib/utils.js';
	import type { Distribution } from '$db/schemas/portfolio';
	import DeleteDialog from '#lib/components/delete-dialog.svelte';
	import { deleteDistribution } from '#lib/remotes/distribution.remote.js';
	import { getHolding } from '#lib/remotes/holding.remote.js';
	import EditDistributionDialog from './edit-distribution-dialog.svelte';

	interface Props {
		distribution: Distribution;
		holdingId: string;
	}

	let { distribution, holdingId }: Props = $props();

	type Dialog = 'edit' | 'delete' | null;
	let dialog = $state<Dialog>(null);

	function formatDate(date: Date | string) {
		return new Date(date).toLocaleDateString('en-AU', {
			day: 'numeric',
			month: 'short',
			year: 'numeric'
		});
	}

	// Convert cents to dollars for display
	const grossPayment = $derived(distribution.grossPayment / 100);
	const taxWithheld = $derived(distribution.taxWithheld / 100);
	const netPayment = $derived(grossPayment - taxWithheld);

	async function handleDelete() {
		await deleteDistribution({ id: distribution.id });
		await getHolding(holdingId).refresh();
		dialog = null;
	}
</script>

<Table.Row>
	<Table.Cell>{formatDate(distribution.datePaid)}</Table.Cell>
	<Table.Cell class="text-right">{formatCurrency(grossPayment * 100)}</Table.Cell>
	<Table.Cell class="text-right">{formatCurrency(taxWithheld * 100)}</Table.Cell>
	<Table.Cell class="text-right font-medium">{formatCurrency(netPayment * 100)}</Table.Cell>
	<Table.Cell>
		{#if distribution.reinvested}
			<CircleCheck class="size-6 text-green-600" />
		{:else}
			<CircleCheck class="size-6 text-muted-foreground opacity-30" />
		{/if}
	</Table.Cell>
	<Table.Cell class="text-right">
		<div class="flex justify-end gap-1">
			<Button variant="ghost" size="icon" onclick={() => (dialog = 'edit')}>
				<Pencil class="size-4" />
			</Button>
			<Button variant="ghost" size="icon" onclick={() => (dialog = 'delete')}>
				<Trash2 class="size-4" />
			</Button>
		</div>
	</Table.Cell>
</Table.Row>

<EditDistributionDialog
	{distribution}
	{holdingId}
	bind:open={() => dialog === 'edit', (v) => (dialog = v ? 'edit' : null)}
/>

<DeleteDialog
	bind:open={() => dialog === 'delete', (v) => (dialog = v ? 'delete' : null)}
	label="distribution"
	onDelete={handleDelete}
	showTrigger={false}
/>
