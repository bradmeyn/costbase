<script lang="ts">
	import { page } from '$app/state';
	import { getNetWorth } from '#lib/remotes/portfolio.remote.js';
	import { getUpcomingSubscriptions } from '#lib/remotes/subscription.remote.js';

	import { formatCurrency } from '#lib/utils/formatters.js';
	import { TrendingUp, TrendingDown, CalendarClock, ChevronRight } from '@lucide/svelte';

	const user = $derived(page.data.user);
	const [netWorth, upcomingSubscriptions] = $derived(
		await Promise.all([getNetWorth(), getUpcomingSubscriptions()])
	);

	function formatFrequency(frequency: string) {
		return frequency.charAt(0).toUpperCase() + frequency.slice(1);
	}

	function formatDueDate(date: Date | string) {
		const d = new Date(date);
		const today = new Date();
		const tomorrow = new Date(today);
		tomorrow.setDate(today.getDate() + 1);

		if (d.toDateString() === today.toDateString()) return 'Today';
		if (d.toDateString() === tomorrow.toDateString()) return 'Tomorrow';

		const diff = Math.ceil((d.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
		if (diff <= 7) return `In ${diff} days`;

		return d.toLocaleDateString('en-AU', { day: 'numeric', month: 'short' });
	}
</script>

<svelte:boundary>
	{#snippet pending()}
		<div class="space-y-6">
			{#each [1, 2, 3] as _}
				<div class="h-28 animate-pulse rounded-2xl bg-muted/60"></div>
			{/each}
		</div>
	{/snippet}

	<div class="space-y-8">
		<div>
			<h1 class="heading-primary">
				{user?.name ? `Welcome back, ${user.name.split(' ')[0]}` : 'Dashboard'}
			</h1>
		</div>

		<!-- Net Worth -->
		<section>
			<h2 class="mb-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
				Net Worth
			</h2>
			<div class="grid gap-4 sm:grid-cols-3">
				<div class="card">
					<p class="text-sm text-muted-foreground">Portfolio Value</p>
					<p class="mt-1 text-3xl font-medium tracking-tight tabular-nums">
						{formatCurrency(netWorth.totalValue)}
					</p>
				</div>
				<div class="card">
					<p class="text-sm text-muted-foreground">Total Invested</p>
					<p class="mt-1 text-3xl font-medium tracking-tight tabular-nums">
						{formatCurrency(netWorth.totalCostBase)}
					</p>
				</div>
				<div class="card">
					<p class="text-sm text-muted-foreground">Unrealised Gain</p>
					<div class="mt-1 flex items-center gap-2">
						<p
							class="text-3xl font-medium tracking-tight tabular-nums {netWorth.totalGain >= 0
								? 'text-emerald-600'
								: 'text-red-500'}"
						>
							{netWorth.totalGain >= 0 ? '+' : ''}{formatCurrency(netWorth.totalGain)}
						</p>
						{#if netWorth.totalGain >= 0}
							<TrendingUp class="size-5 text-emerald-600" />
						{:else}
							<TrendingDown class="size-5 text-red-500" />
						{/if}
					</div>
					<p class="mt-0.5 text-sm {netWorth.totalGain >= 0 ? 'text-emerald-600' : 'text-red-500'}">
						{netWorth.totalGain >= 0 ? '+' : ''}{netWorth.totalGainPercent.toFixed(2)}%
					</p>
				</div>
			</div>
		</section>

		<!-- Upcoming Subscriptions -->
		<section>
			<div class="mb-3 flex items-center justify-between">
				<h2 class="text-xs font-medium uppercase tracking-wider text-muted-foreground">
					Upcoming Subscriptions
				</h2>
				<a
					href="/dashboard/subscriptions"
					class="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
				>
					View all <ChevronRight class="size-3.5" />
				</a>
			</div>

			{#if upcomingSubscriptions.length > 0}
				<div class="card divide-y divide-border p-0">
					{#each upcomingSubscriptions as sub}
						<div class="flex items-center justify-between px-5 py-3.5">
							<div class="flex items-center gap-3">
								<div
									class="flex size-8 items-center justify-center rounded-full bg-muted text-muted-foreground"
								>
									<CalendarClock class="size-4" />
								</div>
								<div>
									<p class="font-medium">{sub.name}</p>
									<p class="text-xs text-muted-foreground">
										{formatFrequency(sub.frequency)}{sub.category ? ` · ${sub.category}` : ''}
									</p>
								</div>
							</div>
							<div class="text-right">
								<p class="font-medium tabular-nums">{formatCurrency(sub.amount / 100)}</p>
								<p class="text-xs text-muted-foreground">{formatDueDate(sub.nextDueDate)}</p>
							</div>
						</div>
					{/each}
				</div>
			{:else}
				<div class="card flex items-center gap-3 text-muted-foreground">
					<CalendarClock class="size-5" />
					<p class="text-sm">No subscriptions due in the next 30 days.</p>
					<a href="/dashboard/subscriptions" class="ml-auto text-sm text-primary hover:underline">
						Add one
					</a>
				</div>
			{/if}
		</section>
	</div>
</svelte:boundary>
