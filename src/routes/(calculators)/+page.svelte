<script lang="ts">
	import { calculators } from '#lib/constants/calculators.js';
</script>

<svelte:head>
	<title>MoneyKit</title>
	<meta name="description" content="My personal financial toolkit." />
</svelte:head>

<section class="container flex flex-col items-center py-24 text-center md:py-36">
	<h1 class="mb-6 max-w-2xl text-3xl leading-[1.1] font-semibold tracking-tight md:text-4xl">
		My Financial Toolkit
	</h1>

	<div class="w-full max-w-xl space-y-4">
		{#each calculators as calculator (calculator.href)}
			<a
				href={calculator.href}
				class="card group flex items-center gap-4 text-left transition-all hover:border-primary/50 hover:shadow-md"
			>
				<div
					class="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 transition-colors group-hover:bg-primary/15"
				>
					<svg
						xmlns="http://www.w3.org/2000/svg"
						viewBox={calculator.viewBox}
						class="size-5 fill-primary"
					>
						{#each calculator.paths as d (d)}<path {d} />{/each}
					</svg>
				</div>
				<div>
					<p class="font-semibold transition-colors group-hover:text-primary">{calculator.name}</p>
					<p class="text-xs text-muted-foreground">{calculator.description}</p>
				</div>
			</a>
		{/each}
	</div>
</section>
