<script lang="ts">
	import { calculators } from '#lib/constants/calculators.js';
	import { getCurrentFinancialYear } from '#lib/utils/cgt-calculations.js';
	import { ArrowRight } from '@lucide/svelte';

	const fy = getCurrentFinancialYear();
	/** The date every Australian tax figure is measured to. */
	const daysToYearEnd = Math.max(
		0,
		Math.ceil((fy.end.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
	);
	const fyLabel = `${fy.year}–${String(fy.year + 1).slice(2)}`;
</script>

<svelte:head>
	<title>Costbase</title>
	<meta
		name="description"
		content="Track Australian share parcels, cost base and capital gains tax."
	/>
</svelte:head>

<section class="container flex max-w-2xl flex-col items-center py-20 text-center md:py-28">
	<h1 class="max-w-xl text-3xl leading-[1.15] font-semibold tracking-tight md:text-4xl">
		Capital gains, parcel by parcel.
	</h1>
	<p class="mt-4 max-w-lg text-[15px] leading-relaxed text-muted-foreground">
		Every share parcel with its own cost base and acquisition date, adjusted for AMIT attribution,
		matched first in first out. Come 30 June, the numbers are already worked out.
	</p>

	<a
		href="/dashboard/portfolios"
		class="mt-7 inline-flex items-center gap-1.5 rounded-md bg-primary-solid px-4 py-2 text-[13px] font-medium text-primary-foreground transition-colors hover:bg-primary-solid/85"
	>
		Open portfolios
		<ArrowRight class="size-4" />
	</a>

	<!-- The financial year is the unit everything here is measured in. -->
	<div class="mt-10 flex w-full items-baseline justify-center gap-10 border-y border-border py-4">
		<div>
			<p class="text-[11px] text-muted-foreground">Financial year</p>
			<p class="mt-0.5 text-xl font-semibold tabular-nums">FY{fyLabel}</p>
		</div>
		<div>
			<p class="text-[11px] text-muted-foreground">Days to 30 June</p>
			<p class="mt-0.5 text-xl font-semibold tabular-nums">{daysToYearEnd}</p>
		</div>
	</div>

	<h2 class="mt-10 text-sm font-semibold">Calculators</h2>
	<p class="mb-3 text-[11px] text-muted-foreground">Standalone, nothing saved.</p>

	<!-- Rows stay left-aligned inside the centred column: centring the label and its
	     description as well would make them hard to scan. -->
	<ul class="w-full border-t border-border text-left">
		{#each calculators as calculator (calculator.href)}
			<li>
				<a
					href={calculator.href}
					class="group flex items-center gap-4 border-b border-border py-3 transition-colors hover:bg-accent/40"
				>
					<svg
						xmlns="http://www.w3.org/2000/svg"
						viewBox={calculator.viewBox}
						class="ml-1 size-4 shrink-0 fill-muted-foreground transition-colors group-hover:fill-primary"
						aria-hidden="true"
					>
						{#each calculator.paths as d (d)}<path {d} />{/each}
					</svg>
					<span class="min-w-0 flex-1">
						<span class="block text-[13px] font-medium transition-colors group-hover:text-primary">
							{calculator.name}
						</span>
						<span class="block text-[11px] text-muted-foreground">{calculator.description}</span>
					</span>
					<ArrowRight
						class="mr-1 size-4 shrink-0 text-muted-foreground/40 transition-colors group-hover:text-primary"
					/>
				</a>
			</li>
		{/each}
	</ul>
</section>
