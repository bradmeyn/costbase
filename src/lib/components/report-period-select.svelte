<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import * as Select from '$ui/select';
	import Input from '$ui/input/input.svelte';
	import Button from '$ui/button/button.svelte';
	import {
		currentFinancialYear,
		describeWindow,
		financialYearWindow,
		matchedFinancialYear,
		readWindow,
		financialYearLabel
	} from '#lib/report-period.js';
	import { queryWith } from '#lib/report-query.js';

	/*
	  Picks the span a report covers. Reports that are a record of activity default to
	  all time and can be narrowed; the two financial years you are most likely to want
	  are one click away, and anything else is a pair of dates.
	*/
	let { years = [] }: { years?: number[] } = $props();

	const period = $derived(readWindow(page.url));
	const thisFy = currentFinancialYear();

	/** Every year worth offering: the two recent ones, plus any with activity. */
	const offered = $derived([...new Set([thisFy, thisFy - 1, ...years])].sort((a, b) => b - a));
	const matchedFy = $derived(matchedFinancialYear(period, offered));

	const isAll = $derived(!period.from && !period.to);
	const value = $derived(isAll ? 'all' : matchedFy ? `fy:${matchedFy}` : 'custom');

	let showCustom = $state(false);
	const customOpen = $derived(showCustom || value === 'custom');

	function go(next: { from?: string; to?: string }) {
		const query = queryWith(page.url, { from: next.from, to: next.to });
		goto(query ? `${page.url.pathname}?${query}` : page.url.pathname);
	}

	function onSelect(v: string) {
		if (v === 'all') {
			showCustom = false;
			go({});
		} else if (v === 'custom') {
			showCustom = true;
		} else {
			showCustom = false;
			go(financialYearWindow(Number(v.slice(3))));
		}
	}

	const label = $derived(
		isAll ? 'All time' : matchedFy ? financialYearLabel(matchedFy) : describeWindow(period)
	);
</script>

<div class="flex flex-wrap items-center justify-end gap-2">
	{#if customOpen}
		<Input
			type="date"
			value={period.from ?? ''}
			onchange={(e) => go({ ...period, from: e.currentTarget.value || undefined })}
			class="h-9 w-[9.5rem]"
			aria-label="From date"
		/>
		<span class="text-[13px] text-muted-foreground">to</span>
		<Input
			type="date"
			value={period.to ?? ''}
			onchange={(e) => go({ ...period, to: e.currentTarget.value || undefined })}
			class="h-9 w-[9.5rem]"
			aria-label="To date"
		/>
		<Button
			variant="ghost"
			onclick={() => {
				showCustom = false;
				go({});
			}}
		>
			Clear
		</Button>
	{:else}
		<Select.Root type="single" {value} onValueChange={(v) => v && onSelect(v)}>
			<Select.Trigger class="w-auto min-w-36" aria-label="Reporting period">
				{label}
			</Select.Trigger>
			<Select.Content>
				<Select.Item value="all">All time</Select.Item>
				<Select.Item value="fy:{thisFy}"
					>This financial year · {financialYearLabel(thisFy)}</Select.Item
				>
				<Select.Item value="fy:{thisFy - 1}"
					>Last financial year · {financialYearLabel(thisFy - 1)}</Select.Item
				>
				{#each offered.filter((y) => y < thisFy - 1) as year (year)}
					<Select.Item value="fy:{year}">{financialYearLabel(year)}</Select.Item>
				{/each}
				<Select.Item value="custom">Custom dates…</Select.Item>
			</Select.Content>
		</Select.Root>
	{/if}
</div>
