<script lang="ts">
	import * as Accordion from '#lib/components/ui/accordion/index.js';
	import { formatCurrency } from '#lib/utils/formatters.js';
	import { type BudgetItem } from '../budget.svelte';

	let {
		category = '',
		categoryTotal = 0,
		children
	}: {
		category?: string;
		type: BudgetItem['type'];
		categoryTotal?: number;
		children: import('svelte').Snippet;
	} = $props();
</script>

<Accordion.Root type="single" class="w-full">
	<Accordion.Item value={category}>
		<Accordion.Trigger class="flex justify-between py-2 w-full border-b rounded-none">
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
