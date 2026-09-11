<script lang="ts">
	import { formatCurrency } from '#lib/utils/formatters.js';
	import { formatFrequency } from '#lib/utils/cashflow.js';
	import RowActionsMenu from '#lib/components/row-actions-menu.svelte';
	import SubscriptionAvatar from './subscription-avatar.svelte';
	import type { Subscription } from '$db/schemas/budget';

	let {
		subscriptions,
		onEdit,
		onDelete
	}: {
		subscriptions: Subscription[];
		onEdit: (sub: Subscription) => void;
		onDelete: (sub: Subscription) => void;
	} = $props();

	function formatDueDate(date: Date | string) {
		return new Date(date).toLocaleDateString('en-AU', {
			day: 'numeric',
			month: 'short',
			year: 'numeric'
		});
	}
</script>

<div class="card divide-y divide-border p-0">
	{#each subscriptions as sub (sub.id)}
		<div class="flex items-center justify-between px-5 py-4">
			<div class="flex items-center gap-3">
				<SubscriptionAvatar name={sub.name} />
				<div>
					<p class="font-medium">{sub.name}</p>
					<p class="text-xs text-muted-foreground">
						{formatFrequency(sub.frequency)}{sub.category ? ` · ${sub.category}` : ''}
					</p>
				</div>
			</div>
			<div class="flex items-center gap-4">
				<div class="text-right">
					<p class="font-medium tabular-nums">{formatCurrency(sub.amount / 100)}</p>
					<p class="text-xs text-muted-foreground">Due {formatDueDate(sub.nextDueDate)}</p>
				</div>
				<RowActionsMenu
					label={sub.name}
					onEdit={() => onEdit(sub)}
					onDelete={() => onDelete(sub)}
				/>
			</div>
		</div>
	{/each}
</div>
