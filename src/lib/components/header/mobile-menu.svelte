<script lang="ts">
	import { page } from '$app/state';
	import { X } from '@lucide/svelte';
	import { calculators } from '#lib/constants/calculators.js';

	let activeUrl = $derived(page.url.pathname);
	let user = $derived(page.data.user);
	let isOpen = $state(false);

	function clickOutside(node: HTMLElement, callback: () => void) {
		function handleClick(event: MouseEvent) {
			if (!node.contains(event.target as Node)) callback();
		}
		document.addEventListener('click', handleClick, true);
		return {
			destroy() {
				document.removeEventListener('click', handleClick, true);
			}
		};
	}

	function closeMenu() {
		isOpen = false;
	}
</script>

<div class="relative block md:hidden" use:clickOutside={closeMenu}>
	<button
		onclick={() => (isOpen = !isOpen)}
		class="ml-auto flex size-5 items-center justify-center rounded-lg p-5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
		aria-expanded={isOpen}
		aria-label="Toggle menu"
	>
		{#if isOpen}
			<X class="size-5" />
		{:else}
			<div class="flex flex-col gap-1">
				<div class="h-0.5 w-4 bg-current"></div>
				<div class="h-0.5 w-4 bg-current"></div>
			</div>
		{/if}
	</button>

	{#if isOpen}
		<div
			class="fixed top-0 right-0 left-0 z-50 max-h-screen overflow-y-auto border-b border-border bg-card shadow-lg"
		>
			<div class="flex items-center justify-between border-b border-border p-4">
				<span class="text-xl font-medium tracking-tight text-foreground">
					Cost<span class="text-primary">base</span>
				</span>
				<button
					onclick={closeMenu}
					class="rounded-lg p-2 transition-colors hover:bg-muted"
					aria-label="Close menu"
				>
					<X class="size-5 text-muted-foreground" />
				</button>
			</div>

			<nav class="space-y-1 p-4">
				<p class="px-4 pb-1 text-xs font-medium tracking-wider text-muted-foreground uppercase">
					Calculators
				</p>
				{#each calculators as calculator (calculator.href)}
					<a
						href={calculator.href}
						onclick={closeMenu}
						class="flex items-center rounded-lg px-4 py-2.5 text-sm transition-colors {activeUrl ===
						calculator.href
							? 'bg-muted font-medium text-foreground'
							: 'text-muted-foreground hover:bg-muted hover:text-foreground'}"
					>
						{calculator.name}
					</a>
				{/each}

				<div class="mt-2 space-y-2 border-t border-border pt-3">
					{#if user}
						<a
							href="/portfolios"
							onclick={closeMenu}
							class="flex w-full items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
						>
							Dashboard
						</a>
					{:else}
						<a
							href="/login"
							onclick={closeMenu}
							class="flex w-full items-center justify-center rounded-md border border-border px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted"
						>
							Log in
						</a>
						<a
							href="/register"
							onclick={closeMenu}
							class="flex w-full items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
						>
							Sign up
						</a>
					{/if}
				</div>
			</nav>
		</div>
	{/if}
</div>
