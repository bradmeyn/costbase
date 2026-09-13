<script lang="ts">
	import { page } from '$app/state';
	import { calculators } from '#lib/constants/calculators.js';
	import * as DropdownMenu from '$ui/dropdown-menu';
	import { ChevronDown } from '@lucide/svelte';

	let activeUrl = $derived(page.url.pathname);
	let user = $derived(page.data.user);
	let calculatorsActive = $derived(calculators.some((c) => activeUrl === c.href));
</script>

<nav class="hidden items-center gap-6 md:flex">
	<DropdownMenu.Root>
		<DropdownMenu.Trigger
			class="flex items-center gap-1 text-sm transition-colors duration-200 {calculatorsActive
				? 'font-medium text-primary'
				: 'text-muted-foreground hover:text-foreground'}"
		>
			Calculators
			<ChevronDown class="size-3.5" />
		</DropdownMenu.Trigger>
		<DropdownMenu.Content align="start" class="w-52">
			{#each calculators as calculator (calculator.href)}
				<DropdownMenu.Item class={activeUrl === calculator.href ? 'font-medium text-primary' : ''}>
					<a href={calculator.href} class="w-full">{calculator.name}</a>
				</DropdownMenu.Item>
			{/each}
		</DropdownMenu.Content>
	</DropdownMenu.Root>

	<div class="ml-2 flex items-center gap-2">
		{#if user}
			<a
				href="/dashboard"
				class="rounded-md bg-primary-solid px-3.5 py-1.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary-solid/85"
			>
				Dashboard
			</a>
		{:else}
			<a
				href="/login"
				class="text-sm text-muted-foreground transition-colors hover:text-foreground"
			>
				Log in
			</a>
			<a
				href="/register"
				class="rounded-md bg-primary-solid px-3.5 py-1.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary-solid/85"
			>
				Sign up
			</a>
		{/if}
	</div>
</nav>
