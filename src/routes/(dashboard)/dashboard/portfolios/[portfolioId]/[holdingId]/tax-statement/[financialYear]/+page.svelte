<script lang="ts">
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import Button from '$ui/button/button.svelte';
	import Input from '$ui/input/input.svelte';
	import { getHolding } from '#lib/remotes/holding.remote.js';
	import { getAmitStatements, saveAmitStatement } from '#lib/remotes/amit.remote.js';
	import {
		AMIT_PART_A,
		AMIT_AUSTRALIAN_INCOME,
		AMIT_FRANKED,
		AMIT_CAPITAL_GAINS,
		AMIT_RECONCILIATION
	} from '#lib/schemas/amit.js';
	import { ArrowLeft } from '@lucide/svelte';

	const portfolioId = $derived(page.params.portfolioId!);
	const holdingId = $derived(page.params.holdingId!);
	const financialYear = $derived(Number(page.params.financialYear));

	const holding = $derived(await getHolding(holdingId));
	const statements = $derived(await getAmitStatements(holdingId));
	const existing = $derived(statements.find((s) => s.financialYear === financialYear));

	/** Stored in cents; the form is entered in dollars. */
	const dollarValue = (field: string) => {
		const cents = existing?.[field as keyof typeof existing];
		return typeof cents === 'number' ? (cents / 100).toFixed(2) : '';
	};

	const fields = saveAmitStatement.fields;

	/**
	 * The amount fields are all RemoteFormField<number>, but indexing `fields` by a
	 * runtime string widens to a union that also includes the form's own methods, which
	 * have no `.as()`. Narrow to just the numeric-field surface we use.
	 */
	type NumberField = { as: (type: 'number') => Record<string, unknown> };
	const amountField = (name: string) =>
		(fields as unknown as Record<string, NumberField>)[name].as('number');
</script>

<svelte:head>
	<title>AMMA statement FY{financialYear} | Costbase</title>
</svelte:head>

<div class="mb-4">
	<a
		href="/dashboard/portfolios/{portfolioId}/{holdingId}/tax-statements"
		class="flex items-center gap-1 text-[13px] text-muted-foreground transition-colors hover:text-foreground"
	>
		<ArrowLeft class="size-4" /> Back to tax statements
	</a>
</div>

<div class="mb-5">
	<h1 class="text-2xl font-semibold tracking-tight">AMMA statement — FY{financialYear}</h1>
	<p class="mt-1 text-[13px] text-muted-foreground">
		{holding.investment.name} ({holding.investment.code}) · year ended 30 June {financialYear}
		{#if existing}
			· <span class="text-brand-3">saved</span>
		{/if}
	</p>
</div>

<form
	{...saveAmitStatement.enhance(async ({ submit }) => {
		await submit();
		if (saveAmitStatement.result?.success) {
			await goto(`/dashboard/portfolios/${portfolioId}/${holdingId}/tax-statements`);
		}
	})}
	class="space-y-5 pb-10"
>
	<input type="hidden" name="holdingId" value={holdingId} />
	<input type="hidden" name="financialYear" value={financialYear} />

	{#each saveAmitStatement.fields.allIssues?.() ?? [] as issue, i (i)}
		<p class="text-[13px] text-destructive">{issue.message}</p>
	{/each}

	{#snippet amountRow(field: string, label: string, code?: string)}
		<div class="flex items-baseline gap-3 border-b border-border/60 py-1.5 last:border-b-0">
			{#if code}
				<span class="w-10 shrink-0 text-[11px] font-medium text-brand-3 tabular-nums">{code}</span>
			{/if}
			<label for={field} class="mb-0 min-w-0 flex-1 text-[13px] text-muted-foreground">
				{label}
			</label>
			<Input
				id={field}
				{...amountField(field)}
				defaultValue={dollarValue(field)}
				step="0.01"
				placeholder="0.00"
				class="w-32 shrink-0 text-right tabular-nums"
			/>
		</div>
	{/snippet}

	<section class="card">
		<h2 class="mb-2 text-sm font-semibold">Part A — tax return items</h2>
		<p class="mb-3 text-[11px] text-muted-foreground">
			These flow straight onto the supplementary section of your return.
		</p>
		{#each AMIT_PART_A as [field, code, label] (field)}
			{@render amountRow(field, label, code)}
		{/each}
	</section>

	<section class="card">
		<h2 class="mb-3 text-sm font-semibold">Part B — Australian income</h2>
		{#each AMIT_AUSTRALIAN_INCOME as [field, label] (field)}
			{@render amountRow(field, label)}
		{/each}
	</section>

	<section class="card">
		<h2 class="mb-3 text-sm font-semibold">Part B — franked distributions</h2>
		{#each AMIT_FRANKED as [field, label] (field)}
			{@render amountRow(field, label)}
		{/each}
	</section>

	<section class="card">
		<h2 class="mb-3 text-sm font-semibold">Part B — capital gains</h2>
		{#each AMIT_CAPITAL_GAINS as [field, label] (field)}
			{@render amountRow(field, label)}
		{/each}
	</section>

	<section class="card">
		<h2 class="mb-2 text-sm font-semibold">Part B — foreign income and reconciliation</h2>
		<p class="mb-3 text-[11px] text-muted-foreground">
			The AMIT cost base amounts adjust your parcels: an excess reduces cost base, a shortfall
			increases it.
		</p>
		{#each AMIT_RECONCILIATION as [field, label] (field)}
			{@render amountRow(field, label)}
		{/each}
	</section>

	<div class="flex items-center justify-end gap-2">
		<Button variant="ghost" href="/dashboard/portfolios/{portfolioId}/{holdingId}/tax-statements"
			>Cancel</Button
		>
		<Button type="submit" disabled={!!saveAmitStatement.pending}>
			{saveAmitStatement.pending ? 'Saving…' : existing ? 'Update statement' : 'Save statement'}
		</Button>
	</div>
</form>
