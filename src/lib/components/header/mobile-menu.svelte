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

<div class="relative md:hidden block" use:clickOutside={closeMenu}>
	<button
		onclick={() => (isOpen = !isOpen)}
		class="flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors ml-auto hover:bg-muted rounded-lg size-5 p-5"
		aria-expanded={isOpen}
		aria-label="Toggle menu"
	>
		{#if isOpen}
			<X class="size-5" />
		{:else}
			<div class="flex flex-col gap-1">
				<div class="w-4 h-0.5 bg-current"></div>
				<div class="w-4 h-0.5 bg-current"></div>
			</div>
		{/if}
	</button>

	{#if isOpen}
		<div
			class="fixed top-0 left-0 right-0 bg-card shadow-lg z-50 max-h-screen overflow-y-auto border-b border-border"
		>
			<div class="flex items-center justify-between p-4 border-b border-border">
				<span class="text-foreground text-xl font-medium tracking-tight">
					Money<span class="text-transparent bg-clip-text bg-linear-to-b from-primary to-brand"
						>Kit</span
					>
				</span>
				<button
					onclick={closeMenu}
					class="p-2 hover:bg-muted rounded-lg transition-colors"
					aria-label="Close menu"
				>
					<X class="size-5 text-muted-foreground" />
				</button>
			</div>

			<nav class="p-4 space-y-1">
				<p class="px-4 pb-1 text-xs font-medium text-muted-foreground uppercase tracking-wider">
					Calculators
				</p>
				{#each calculators as calculator}
					<a
						href={calculator.href}
						onclick={closeMenu}
						class="flex items-center rounded-lg px-4 py-2.5 text-sm transition-colors {activeUrl ===
						calculator.href
							? 'text-foreground bg-muted font-medium'
							: 'text-muted-foreground hover:text-foreground hover:bg-muted'}"
					>
						{calculator.name}
					</a>
				{/each}

				<div class="pt-3 border-t border-border mt-2 space-y-2">
					{#if user}
						<a
							href="/portfolios"
							onclick={closeMenu}
							class="flex items-center justify-center w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
						>
							Dashboard
						</a>
					{:else}
						<a
							href="/login"
							onclick={closeMenu}
							class="flex items-center justify-center w-full rounded-md border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted transition-colors"
						>
							Log in
						</a>
						<a
							href="/register"
							onclick={closeMenu}
							class="flex items-center justify-center w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
						>
							Sign up
						</a>
					{/if}
				</div>
			</nav>
		</div>
	{/if}
</div>
