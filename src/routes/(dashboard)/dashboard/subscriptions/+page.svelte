<script lang="ts">
	import { getSubscriptions, deleteSubscription } from '#lib/remotes/subscription.remote.js';
	import { formatCurrency } from '#lib/utils/formatters.js';
	import { toMonthly } from '#lib/utils/cashflow.js';
	import { Button } from '$ui/button';
	import { Plus, CalendarClock } from '@lucide/svelte';
	import DeleteDialog from '#lib/components/delete-dialog.svelte';
	import SummaryCard from '#lib/components/summary-card.svelte';
	import SubscriptionDialog from './_components/subscription-dialog.svelte';
	import SubscriptionList from './_components/subscription-list.svelte';
	import SubscriptionSpendBars from './_components/subscription-spend-bars.svelte';
	import type { Subscription } from '$db/schemas/budget';

	const subscriptions = $derived(await getSubscriptions());

	// monthly spend per subscription (dollars), sorted high → low
	const spend = $derived(
		subscriptions
			.map((s) => ({ ...s, monthly: toMonthly(s.amount / 100, s.frequency) }))
			.sort((a, b) => b.monthly - a.monthly)
	);
	const totalMonthly = $derived(spend.reduce((sum, s) => sum + s.monthly, 0));

	type Dialog =
		| { kind: 'add' }
		| { kind: 'edit'; subscription: Subscription }
		| { kind: 'delete'; subscription: Subscription }
		| null;

	let dialog = $state<Dialog>(null);
</script>

<svelte:head>
	<title>Subscriptions | MoneyKit</title>
</svelte:head>

<svelte:boundary>
	{#snippet pending()}
		<div class="space-y-3">
			{#each [1, 2, 3] as _}
				<div class="h-16 animate-pulse rounded-2xl bg-muted/60"></div>
			{/each}
		</div>
	{/snippet}

	<div class="space-y-6">
		<div class="flex items-center justify-between">
			<div>
				<h1 class="heading-primary">Subscriptions</h1>
				<p class="mt-1 text-sm text-muted-foreground">Track your recurring expenses.</p>
			</div>
			<Button onclick={() => (dialog = { kind: 'add' })}>
				<Plus class="mr-2 size-4" />
				Add
			</Button>
		</div>

		{#if subscriptions.length > 0}
			<div class="grid gap-4 sm:grid-cols-3">
				<SummaryCard label="Monthly spend" value={formatCurrency(totalMonthly)} />
				<SummaryCard label="Yearly spend" value={formatCurrency(totalMonthly * 12)} />
				<SummaryCard label="Active" value={String(subscriptions.length)} />
			</div>

			<div class="grid gap-6 lg:grid-cols-3">
				<div class="lg:col-span-2">
					<SubscriptionList
						{subscriptions}
						onEdit={(subscription) => (dialog = { kind: 'edit', subscription })}
						onDelete={(subscription) => (dialog = { kind: 'delete', subscription })}
					/>
				</div>
				<SubscriptionSpendBars {spend} />
			</div>
		{:else}
			<div class="card flex flex-col items-center justify-center py-12 text-center">
				<CalendarClock class="mb-3 size-10 text-muted-foreground" />
				<p class="mb-1 font-medium">No subscriptions yet</p>
				<p class="mb-4 text-sm text-muted-foreground">Add your recurring expenses to track them.</p>
				<Button onclick={() => (dialog = { kind: 'add' })}>
					<Plus class="mr-2 size-4" />
					Add Subscription
				</Button>
			</div>
		{/if}
	</div>
</svelte:boundary>

<SubscriptionDialog
	open={dialog?.kind === 'add'}
	onOpenChange={(o) => (dialog = o ? { kind: 'add' } : null)}
/>

{#if dialog?.kind === 'edit'}
	<SubscriptionDialog
		open
		onOpenChange={(o) => !o && (dialog = null)}
		subscription={dialog.subscription}
	/>
{/if}

<DeleteDialog
	open={dialog?.kind === 'delete'}
	onOpenChange={(o) => !o && (dialog = null)}
	showTrigger={false}
	label={dialog?.kind === 'delete' ? dialog.subscription.name : 'subscription'}
	onDelete={async () => {
		if (dialog?.kind === 'delete') {
			await deleteSubscription({ id: dialog.subscription.id });
			dialog = null;
		}
	}}
/>
