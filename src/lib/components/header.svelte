<script lang="ts">
	import { resolve } from '$app/paths';
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
			<a href={resolve('/(calculators)')} class="text-xl font-medium tracking-tight">
				Cost<span class="text-primary">base</span>
			</a>

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
							<DropdownMenu.Item
								class={activeUrl === calculator.href ? 'font-medium text-primary' : ''}
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
				class="text-sm text-muted-foreground transition-colors hover:text-foreground"
			>
				Log out
			</button>
		</form>
	</div>
</header>
