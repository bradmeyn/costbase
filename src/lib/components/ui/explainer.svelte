<script lang="ts">
	import * as Tooltip from '#lib/components/ui/tooltip/index.js';
	import { CircleHelp } from '@lucide/svelte';
	let { text }: { text: string } = $props();
</script>

<Tooltip.Provider>
	<Tooltip.Root>
		<Tooltip.Trigger class="text-muted-foreground hover:text-foreground transition-colors">
			<CircleHelp class="size-4" />
		</Tooltip.Trigger>
		<Tooltip.Content>
			<p>{text}</p>
		</Tooltip.Content>
	</Tooltip.Root>
</Tooltip.Provider>
