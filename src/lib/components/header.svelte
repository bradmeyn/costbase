<script lang="ts">
	import { page } from '$app/state';
	import { logoutUser } from '#lib/remotes/auth.remote.js';
	import { calculators } from '#lib/constants/calculators.js';
	import * as DropdownMenu from '$ui/dropdown-menu';
	import { ChevronDown } from '@lucide/svelte';

	let activeUrl = $derived(page.url.pathname);
	let calculatorsActive = $derived(calculators.some((c) => activeUrl === c.href));
</script>

<header class="border-b bg-card">
	<div class="container flex items-center justify-between py-3">
		<div class="flex items-center gap-8">
			<a href="/" class="text-xl font-medium tracking-tight">
				Money<span class="text-transparent bg-clip-text bg-linear-to-b from-primary to-primary-dark"
					>Kit</span
				>
			</a>

			<nav class="hidden md:flex items-center gap-6">
				<DropdownMenu.Root>
					<DropdownMenu.Trigger
						class="flex items-center gap-1 text-sm transition-colors duration-200 {calculatorsActive
							? 'text-primary font-medium'
							: 'text-muted-foreground hover:text-foreground'}"
					>
						Calculators
						<ChevronDown class="size-3.5" />
					</DropdownMenu.Trigger>
					<DropdownMenu.Content align="start" class="w-52">
						{#each calculators as calculator}
							<DropdownMenu.Item
								class={activeUrl === calculator.href ? 'text-primary font-medium' : ''}
							>
								<a href={calculator.href} class="w-full">{calculator.name}</a>
							</DropdownMenu.Item>
						{/each}
					</DropdownMenu.Content>
				</DropdownMenu.Root>
			</nav>
		</div>

		<form {...logoutUser} method="POST">
			<button
				type="submit"
				class="text-sm text-muted-foreground hover:text-foreground transition-colors"
			>
				Log out
			</button>
		</form>
	</div>
</header>
