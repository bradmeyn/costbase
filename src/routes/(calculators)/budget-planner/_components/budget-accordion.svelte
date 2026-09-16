<script lang="ts">
	import * as Accordion from '#lib/components/ui/accordion/index.js';
	import { formatCurrency } from '#lib/utils/formatters.js';

	let {
		category = '',
		categoryTotal = 0,
		children
	}: {
		category?: string;
		categoryTotal?: number;
		children: import('svelte').Snippet;
	} = $props();
</script>

<Accordion.Root type="single" class="w-full">
	<Accordion.Item value={category}>
		<Accordion.Trigger class="flex w-full justify-between rounded-none border-b py-2">
			<div class="text-left">
				<h3 class="text-sm text-muted-foreground">{category}</h3>
				<p class="text-lg">{formatCurrency(categoryTotal, false)}</p>
			</div>
		</Accordion.Trigger>
		<Accordion.Content>
			{@render children()}
		</Accordion.Content>
	</Accordion.Item>
</Accordion.Root>
