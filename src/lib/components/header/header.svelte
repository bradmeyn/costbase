<script lang="ts">
	import { resolve } from '$app/paths';
	import DesktopMenu from './desktop-menu.svelte';
	import MobileMenu from './mobile-menu.svelte';
</script>

<header class="relative">
	<div class="relative container">
		<div class="flex w-full items-center justify-between gap-8 py-5">
			<a href={resolve('/(calculators)')} class="flex items-center">
				<span class="text-xl font-medium tracking-tight text-foreground"
					>Cost<span class="text-primary">base</span>
				</span>
			</a>

			<DesktopMenu />
			<MobileMenu />
		</div>
	</div>
</header>
