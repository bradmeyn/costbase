<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import Button from '$ui/button/button.svelte';
	import * as DropdownMenu from '$ui/dropdown-menu';
	import { ChevronDown } from '@lucide/svelte';
	import { queryWith, readList, toggle } from '#lib/report-query.js';

	/*
	  Narrows a report to some of its rows. Selecting nothing means everything, which
	  is both the default and the only sensible reading of an empty filter.
	*/
	let {
		param,
		options,
		allLabel,
		/** Plural noun for the count, e.g. "holdings" in "2 holdings". */
		noun
	}: {
		param: string;
		options: { value: string; label: string }[];
		allLabel: string;
		noun: string;
	} = $props();

	const selected = $derived(readList(page.url, param));
	/* A value that no longer exists — a holding sold and removed — should not count. */
	const live = $derived(selected.filter((v) => options.some((o) => o.value === v)));

	const label = $derived(
		live.length === 0
			? allLabel
			: live.length === 1
				? (options.find((o) => o.value === live[0])?.label ?? live[0])
				: `${live.length} ${noun}`
	);

	function apply(next: string[]) {
		const query = queryWith(page.url, { [param]: next.length ? next.join(',') : undefined });
		goto(query ? `${page.url.pathname}?${query}` : page.url.pathname);
	}
</script>

<DropdownMenu.Root>
	<DropdownMenu.Trigger>
		{#snippet child({ props })}
			<Button
				{...props}
				variant="outline"
				class="font-normal {live.length > 0 ? 'border-primary/50 text-primary' : ''}"
			>
				{label}
				<ChevronDown class="size-3.5" />
			</Button>
		{/snippet}
	</DropdownMenu.Trigger>
	<DropdownMenu.Content align="end" class="min-w-44">
		<DropdownMenu.Item disabled={live.length === 0} onSelect={() => apply([])}>
			{allLabel}
		</DropdownMenu.Item>
		<DropdownMenu.Separator />
		{#each options as option (option.value)}
			<DropdownMenu.CheckboxItem
				closeOnSelect={false}
				checked={live.includes(option.value)}
				onCheckedChange={(on) => apply(toggle(live, option.value, on))}
			>
				{option.label}
			</DropdownMenu.CheckboxItem>
		{/each}
	</DropdownMenu.Content>
</DropdownMenu.Root>
