<script lang="ts">
	import * as Tooltip from '#lib/components/ui/tooltip/index.js';
	import { CircleHelp } from '@lucide/svelte';

	let {
		text,
		/**
		 * Render the trigger as a <span> instead of a <button>. Use inside another
		 * button — a nested <button> is invalid HTML and breaks hydration.
		 */
		inline = false
	}: { text: string; inline?: boolean } = $props();
</script>

<Tooltip.Provider>
	<Tooltip.Root>
		{#if inline}
			<Tooltip.Trigger>
				{#snippet child({ props })}
					<span
						{...props}
						class="inline-flex text-muted-foreground transition-colors hover:text-foreground"
					>
						<CircleHelp class="size-4" />
					</span>
				{/snippet}
			</Tooltip.Trigger>
		{:else}
			<Tooltip.Trigger class="text-muted-foreground transition-colors hover:text-foreground">
				<CircleHelp class="size-4" />
			</Tooltip.Trigger>
		{/if}
		<Tooltip.Content>
			<p>{text}</p>
		</Tooltip.Content>
	</Tooltip.Root>
</Tooltip.Provider>
