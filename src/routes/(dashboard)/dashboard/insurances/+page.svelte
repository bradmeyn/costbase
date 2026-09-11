<script lang="ts">
	import { getInsurances, deleteInsurance } from '#lib/remotes/insurance.remote.js';
	import { formatCurrency } from '#lib/utils/formatters.js';
	import { toMonthly, formatFrequency } from '#lib/utils/cashflow.js';
	import * as Table from '$ui/table';
	import { Button } from '$ui/button';
	import { Plus, ShieldCheck } from '@lucide/svelte';
	import RowActionsMenu from '#lib/components/row-actions-menu.svelte';
	import DeleteDialog from '#lib/components/delete-dialog.svelte';
	import AddInsuranceDialog from './_components/add-insurance-dialog.svelte';
	import EditInsuranceDialog from './_components/edit-insurance-dialog.svelte';
	import type { Insurance } from '$db/schemas/budget';

	const insurances = $derived(await getInsurances());

	const monthlyPremiums = $derived(
		insurances.reduce((s, i) => s + toMonthly(i.premium / 100, i.frequency), 0)
	);

	function formatDate(date: Date | string) {
		return new Date(date).toLocaleDateString('en-AU', {
			day: 'numeric',
			month: 'short',
			year: 'numeric'
		});
	}

	type Dialog =
		| { kind: 'add' }
		| { kind: 'edit'; insurance: Insurance }
		| { kind: 'delete'; insurance: Insurance }
		| null;

	let dialog = $state<Dialog>(null);
</script>

<svelte:head><title>Insurances | MoneyKit</title></svelte:head>

<svelte:boundary>
	{#snippet pending()}
		<div class="space-y-4">
			{#each [1, 2, 3] as _}<div class="h-20 animate-pulse rounded-2xl bg-muted/60"></div>{/each}
		</div>
	{/snippet}

	<div class="space-y-6">
		<div class="flex items-center justify-between">
			<div>
				<h1 class="heading-primary">Insurances</h1>
				<p class="mt-1 text-sm text-muted-foreground">Track your policies and premiums.</p>
			</div>
			<Button onclick={() => (dialog = { kind: 'add' })}>
				<Plus class="mr-2 size-4" /> Add
			</Button>
		</div>

		{#if insurances.length > 0}
			<div class="card flex items-baseline justify-between">
				<div>
					<p class="text-xs font-medium uppercase tracking-wider text-muted-foreground">
						Monthly premiums
					</p>
					<p class="mt-1 text-3xl font-medium tracking-tight tabular-nums">
						{formatCurrency(monthlyPremiums)}
					</p>
				</div>
				<p class="text-sm text-muted-foreground tabular-nums">
					{formatCurrency(monthlyPremiums * 12)} / year
				</p>
			</div>

			<div class="card p-0">
				<Table.Root>
					<Table.Header>
						<Table.Row>
							<Table.Head>Name</Table.Head>
							<Table.Head>Type</Table.Head>
							<Table.Head>Premium</Table.Head>
							<Table.Head>Renewal</Table.Head>
							<Table.Head>Owner</Table.Head>
							<Table.Head class="w-10"></Table.Head>
						</Table.Row>
					</Table.Header>
					<Table.Body>
						{#each insurances as insurance (insurance.id)}
							<Table.Row>
								<Table.Cell>
									<div class="font-medium">{insurance.name}</div>
									<div class="text-xs text-muted-foreground">{insurance.provider}</div>
								</Table.Cell>
								<Table.Cell class="text-muted-foreground">{insurance.category}</Table.Cell>
								<Table.Cell class="tabular-nums">
									{formatCurrency(insurance.premium / 100)}
									<span class="text-xs text-muted-foreground">
										/ {formatFrequency(insurance.frequency)}
									</span>
								</Table.Cell>
								<Table.Cell class="text-muted-foreground"
									>{formatDate(insurance.renewalDate)}</Table.Cell
								>
								<Table.Cell class="text-muted-foreground">{insurance.owner}</Table.Cell>
								<Table.Cell class="text-right">
									<RowActionsMenu
										label={insurance.name}
										onEdit={() => (dialog = { kind: 'edit', insurance })}
										onDelete={() => (dialog = { kind: 'delete', insurance })}
									/>
								</Table.Cell>
							</Table.Row>
						{/each}
					</Table.Body>
				</Table.Root>
			</div>
		{:else}
			<div class="card flex flex-col items-center justify-center py-12 text-center">
				<ShieldCheck class="mb-3 size-10 text-muted-foreground" />
				<p class="mb-1 font-medium">No insurances yet</p>
				<p class="mb-4 text-sm text-muted-foreground">Add your policies to track premiums.</p>
				<Button onclick={() => (dialog = { kind: 'add' })}>
					<Plus class="mr-2 size-4" /> Add Insurance
				</Button>
			</div>
		{/if}
	</div>
</svelte:boundary>

<AddInsuranceDialog
	open={dialog?.kind === 'add'}
	onOpenChange={(o) => (dialog = o ? { kind: 'add' } : null)}
/>

{#if dialog?.kind === 'edit'}
	<EditInsuranceDialog
		open
		onOpenChange={(o) => !o && (dialog = null)}
		insurance={dialog.insurance}
	/>
{/if}

<DeleteDialog
	open={dialog?.kind === 'delete'}
	onOpenChange={(o) => !o && (dialog = null)}
	showTrigger={false}
	label={dialog?.kind === 'delete' ? dialog.insurance.name : 'insurance'}
	onDelete={async () => {
		if (dialog?.kind === 'delete') {
			await deleteInsurance({ id: dialog.insurance.id });
			dialog = null;
		}
	}}
/>
