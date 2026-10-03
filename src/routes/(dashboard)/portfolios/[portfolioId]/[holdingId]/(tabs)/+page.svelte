<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import * as Table from '#lib/components/ui/table/index.js';
	import Button from '#lib/components/ui/button/button.svelte';
	import AddTransactionsDialog from '#lib/components/transaction/add-transactions-dialog.svelte';
	import ImportTransactionsDialog from '#lib/components/transaction/import-transactions-dialog.svelte';
	import TransactionRow from '#lib/components/transaction/transaction-row.svelte';
	import ReportFilterMenu from '#lib/components/report-filter-menu.svelte';
	import ReportPeriodSelect from '#lib/components/report-period-select.svelte';
	import { ArrowDown, ArrowUp, ArrowUpDown, FileSpreadsheet, Plus } from '@lucide/svelte';
	import { getHolding } from '#lib/remotes/holding.remote.js';
	import { currentFinancialYear, isoDay, readWindow } from '#lib/report-period.js';
	import { queryWith, readList, TRANSACTION_TYPES, UNSET } from '#lib/report-query.js';

	const holdingId = $derived(page.params.holdingId!);
	const holding = $derived(await getHolding(holdingId));

	let addTransactionsOpen = $state(false);
	let importOpen = $state(false);

	/*
	  Filters and sort live in the query string, as on the reports: a narrowed list
	  survives a reload and can be linked to.
	*/
	const period = $derived(readWindow(page.url));
	const types = $derived(readList(page.url, 'type'));
	const platforms = $derived(readList(page.url, 'platform'));

	type SortKey = 'date' | 'type' | 'quantity' | 'price' | 'brokerage' | 'total';
	const SORT_KEYS: SortKey[] = ['date', 'type', 'quantity', 'price', 'brokerage', 'total'];
	const sortKey = $derived(
		SORT_KEYS.find((k) => k === page.url.searchParams.get('sort')) ?? 'date'
	);
	// Newest first unless asked otherwise: the latest trade is the one you came to check.
	const ascending = $derived(page.url.searchParams.get('dir') === 'asc');

	const total = (t: { value: number | null; quantity: number; pricePerUnit: number }) =>
		t.value ?? t.quantity * t.pricePerUnit;

	const SORT_VALUE: Record<SortKey, (t: (typeof holding.transactions)[number]) => number | string> =
		{
			date: (t) => new Date(t.transactionDate).getTime(),
			type: (t) => t.type,
			quantity: (t) => t.quantity,
			price: (t) => t.pricePerUnit,
			brokerage: (t) => t.brokerage ?? 0,
			total
		};

	const transactions = $derived.by(() => {
		const value = SORT_VALUE[sortKey];
		const byDate = SORT_VALUE.date;
		return holding.transactions
			.filter((t) => {
				const day = isoDay(new Date(t.transactionDate));
				return (!period.from || day >= period.from) && (!period.to || day <= period.to);
			})
			.filter((t) => types.length === 0 || types.includes(t.type))
			.filter((t) => platforms.length === 0 || platforms.includes(t.platform ?? UNSET))
			.toSorted((a, b) => {
				const [x, y] = [value(a), value(b)];
				// Ties fall back to date, so rows of one type still read in order.
				const order = x < y ? -1 : x > y ? 1 : byDate(a) < byDate(b) ? -1 : 1;
				return ascending ? order : -order;
			});
	});

	const filtered = $derived(
		!!(period.from || period.to) || types.length > 0 || platforms.length > 0
	);

	/** The years with a trade in them, for the period picker. */
	const years = $derived([
		...new Set(holding.transactions.map((t) => currentFinancialYear(new Date(t.transactionDate))))
	]);

	const platformOptions = $derived([
		...[...new Set(holding.transactions.map((t) => t.platform).filter((p) => p !== null))]
			.sort()
			.map((p) => ({ value: p, label: p })),
		...(holding.transactions.some((t) => !t.platform)
			? [{ value: UNSET, label: 'No platform' }]
			: [])
	]);

	function go(patch: Record<string, string | undefined>) {
		const query = queryWith(page.url, patch);
		goto(query ? `${page.url.pathname}?${query}` : page.url.pathname, {
			replace: true,
			reset: false
		});
	}

	/** A header click sorts by that column; a second click on it flips the direction. */
	function sortBy(key: SortKey) {
		// Text reads A→Z first; dates and amounts read largest (newest) first.
		const nextAscending = key === sortKey ? !ascending : key === 'type';
		// Newest first by date is the default, and a default is left out of the URL.
		const isDefault = key === 'date' && !nextAscending;
		go({
			sort: key === 'date' ? undefined : key,
			dir: isDefault ? undefined : nextAscending ? 'asc' : 'desc'
		});
	}

	function clearFilters() {
		go({ from: undefined, to: undefined, type: undefined, platform: undefined });
	}
</script>

<AddTransactionsDialog {holdingId} bind:open={addTransactionsOpen} showTrigger={false} />
<ImportTransactionsDialog {holdingId} bind:open={importOpen} />

{#snippet sortHead(key: SortKey, label: string, align: 'left' | 'right' = 'left')}
	<Table.Head
		class={align === 'right' ? 'text-right' : ''}
		aria-sort={sortKey === key ? (ascending ? 'ascending' : 'descending') : 'none'}
	>
		<button
			type="button"
			onclick={() => sortBy(key)}
			class="group inline-flex items-center gap-1 hover:text-foreground {align === 'right'
				? 'flex-row-reverse'
				: ''} {sortKey === key ? 'text-foreground' : ''}"
		>
			{label}
			{#if sortKey === key}
				{#if ascending}
					<ArrowUp class="size-3.5" />
				{:else}
					<ArrowDown class="size-3.5" />
				{/if}
			{:else}
				<ArrowUpDown class="size-3.5 opacity-0 transition-opacity group-hover:opacity-50" />
			{/if}
		</button>
	</Table.Head>
{/snippet}

<div class="mb-4 flex items-center justify-between gap-2">
	<h2 class="text-base font-semibold">Transactions</h2>
	<div class="flex gap-2">
		<Button variant="outline" onclick={() => (importOpen = true)} class="gap-1.5">
			<FileSpreadsheet class="size-4" />
			Import CSV
		</Button>
		<Button onclick={() => (addTransactionsOpen = true)} class="gap-1.5">
			<Plus class="size-4" />
			Add transactions
		</Button>
	</div>
</div>

{#if holding.transactions.length > 0}
	<div class="mb-3 flex flex-wrap items-center gap-2">
		<ReportPeriodSelect {years} />
		<ReportFilterMenu param="type" options={TRANSACTION_TYPES} allLabel="All types" noun="types" />
		{#if platformOptions.length > 1}
			<ReportFilterMenu
				param="platform"
				options={platformOptions}
				allLabel="All platforms"
				noun="platforms"
			/>
		{/if}
		<span class="ml-auto text-[13px] text-muted-foreground tabular-nums">
			{#if filtered}
				{transactions.length} of {holding.transactions.length}
				<button
					type="button"
					onclick={clearFilters}
					class="ml-1 text-primary underline-offset-4 hover:underline"
				>
					Clear filters
				</button>
			{:else}
				{holding.transactions.length} transaction{holding.transactions.length === 1 ? '' : 's'}
			{/if}
		</span>
	</div>

	<div class="card">
		<Table.Root>
			<Table.Header>
				<Table.Row>
					{@render sortHead('date', 'Date')}
					{@render sortHead('type', 'Type')}
					{@render sortHead('quantity', 'Quantity', 'right')}
					{@render sortHead('price', 'Price per Unit', 'right')}
					{@render sortHead('brokerage', 'Brokerage', 'right')}
					{@render sortHead('total', 'Total', 'right')}
					<Table.Head class="text-right">Actions</Table.Head>
				</Table.Row>
			</Table.Header>
			<Table.Body>
				{#each transactions as transaction (transaction.id)}
					<TransactionRow {transaction} />
				{:else}
					<Table.Row>
						<Table.Cell colspan={7} class="py-8 text-center text-muted-foreground">
							No transactions match these filters.
						</Table.Cell>
					</Table.Row>
				{/each}
			</Table.Body>
		</Table.Root>
	</div>
{:else}
	<div class="card flex flex-col items-center justify-center py-12 text-center">
		<p class="mb-4 text-muted-foreground">
			No transactions yet. Add one by hand or from its contract note, or import a CSV.
		</p>
		<div class="flex gap-2">
			<Button variant="outline" onclick={() => (importOpen = true)}>Import CSV</Button>
			<Button onclick={() => (addTransactionsOpen = true)}>Add transactions</Button>
		</div>
	</div>
{/if}
