<script lang="ts">
	import { resolve } from '$app/paths';
	import { calculators } from '#lib/constants/calculators.js';
	import { ArrowRight, Layers, RefreshCcw, FileText } from '@lucide/svelte';

	/** What the app actually does, in the order you'd meet it. */
	const features = [
		{
			icon: Layers,
			title: 'Every parcel, separately',
			body: 'Each buy is its own parcel with its own cost base and acquisition date. Disposals match first in, first out, so the twelve-month discount lands on the right units.'
		},
		{
			icon: RefreshCcw,
			title: 'AMIT adjustments applied',
			body: 'Enter the annual AMMA statement and the cost base net amount is apportioned across the parcels you held at 30 June — excess down, shortfall up.'
		},
		{
			icon: FileText,
			title: 'Tax return figures, ready',
			body: 'A capital gains report per financial year: 18H and 18A with the full working, plus the 13 and 20 series labels from each holding.'
		}
	];
</script>

<svelte:head>
	<title>Costbase</title>
	<meta
		name="description"
		content="Track Australian share parcels, cost base and capital gains tax."
	/>
</svelte:head>

<section class="container flex max-w-5xl flex-col items-center py-20 text-center md:py-24">
	<h1 class="max-w-xl text-3xl leading-[1.15] font-semibold tracking-tight md:text-4xl">
		Capital gains, parcel by parcel.
	</h1>
	<p class="mt-4 max-w-lg text-[15px] leading-relaxed text-muted-foreground">
		Every share parcel with its own cost base and acquisition date, adjusted for AMIT attribution,
		matched first in first out. Come 30 June, the numbers are already worked out.
	</p>

	<a
		href={resolve('/(dashboard)/portfolios')}
		class="mt-7 inline-flex items-center gap-1.5 rounded-md bg-primary-solid px-4 py-2 text-[13px] font-medium text-primary-foreground transition-colors hover:bg-primary-solid/85"
	>
		Open portfolios
		<ArrowRight class="size-4" />
	</a>

	<!--
		Features are informational, so they deliberately carry no card chrome — only the
		calculators below are clickable, and cards signal that.
	-->
	<div class="mt-16 grid w-full gap-8 text-left md:grid-cols-3 md:gap-10">
		{#each features as feature (feature.title)}
			{@const Icon = feature.icon}
			<div>
				<Icon class="size-4 text-primary" aria-hidden="true" />
				<h2 class="mt-3 text-sm font-semibold">{feature.title}</h2>
				<p class="mt-1.5 text-[13px] leading-relaxed text-muted-foreground">{feature.body}</p>
			</div>
		{/each}
	</div>

	<div class="mt-16 w-full border-t border-border pt-8 text-left">
		<h2 class="text-sm font-semibold">Other tools</h2>
		<p class="mt-1 text-[11px] text-muted-foreground">Standalone calculators. Nothing saved.</p>

		<div class="mt-3 grid gap-3 md:grid-cols-3">
			{#each calculators as calculator (calculator.href)}
				{@const Icon = calculator.icon}
				<a
					href={calculator.href}
					class="group flex items-start gap-3 rounded-md border border-border bg-card p-4 transition-colors hover:border-primary/40"
				>
					<span
						class="flex size-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary transition-colors group-hover:bg-primary/15"
					>
						<Icon class="size-4" aria-hidden="true" />
					</span>
					<span class="min-w-0">
						<span class="block text-sm font-medium transition-colors group-hover:text-primary">
							{calculator.name}
						</span>
						<span class="mt-1 block text-[11px] leading-relaxed text-muted-foreground">
							{calculator.description}
						</span>
					</span>
				</a>
			{/each}
		</div>
	</div>
</section>
