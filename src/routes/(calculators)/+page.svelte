<script lang="ts">
	import { calculators } from '#lib/constants/calculators.js';
</script>

<svelte:head>
	<title>MoneyKit</title>
	<meta name="description" content="My personal financial toolkit." />
</svelte:head>

<section class="container py-24 md:py-36 flex flex-col items-center text-center">
	<h1 class="text-4xl md:text-6xl font-semibold tracking-tight mb-8 max-w-2xl leading-[1.05]">
		My Financial Toolkit
	</h1>

	<div class="space-y-4 w-full max-w-xl">
		{#each calculators as calculator}
			<a
				href={calculator.href}
				class="card group hover:border-primary/50 hover:shadow-md transition-all text-left flex items-center gap-4"
			>
				<div
					class="size-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0 group-hover:bg-primary/15 transition-colors"
				>
					<svg
						xmlns="http://www.w3.org/2000/svg"
						viewBox={calculator.viewBox}
						class="size-5 fill-primary"
					>
						{#each calculator.paths as d}<path {d} />{/each}
					</svg>
				</div>
				<div>
					<p class="font-semibold group-hover:text-primary transition-colors">{calculator.name}</p>
					<p class="text-xs text-muted-foreground">{calculator.description}</p>
				</div>
			</a>
		{/each}
	</div>
</section>
