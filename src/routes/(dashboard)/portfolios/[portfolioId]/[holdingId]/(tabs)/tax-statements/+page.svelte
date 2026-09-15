<script lang="ts">
	import { financialYearLabel } from '#lib/report-period.js';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import * as Table from '$ui/table';
	import Button from '$ui/button/button.svelte';
	import { getAmitStatements } from '#lib/remotes/amit.remote.js';
	import { getAnnualStatements } from '#lib/remotes/annual.remote.js';
	import { netCostBaseAmount } from '#lib/utils/amit-calculations.js';
	import { formatCurrency } from '#lib/utils.js';
	import DocumentAttachment from '#lib/components/document-attachment.svelte';

	const holdingId = $derived(page.params.holdingId!);
	const portfolioId = $derived(page.params.portfolioId!);
	const amitStatements = $derived(await getAmitStatements(holdingId));
	/*
	  The registry's own statement for the same year. It carries no tax figures — it is
	  here so its unit count sits beside the attribution it belongs with, and so both
	  documents for a year are one click apart.
	*/
	const annualStatements = $derived(await getAnnualStatements(holdingId));

	/** Years worth offering, newest first: this FY plus the four before it. */
	const currentFyEnd =
		new Date().getMonth() >= 6 ? new Date().getFullYear() + 1 : new Date().getFullYear();
	const offerableYears = $derived(
		[
			...new Set([
				...Array.from({ length: 5 }, (_, i) => currentFyEnd - i),
				...amitStatements.map((s) => s.financialYear),
				...annualStatements.map((s) => s.financialYear)
			])
		].sort((a, b) => b - a)
	);
</script>

<div class="mb-4">
	<h2 class="text-base font-semibold">Tax statements</h2>
	<p class="mt-1 text-[11px] text-muted-foreground">
		Annual AMIT Member Annual Statement (AMMA). Drives the cost base adjustments used in the capital
		gains report.
	</p>
</div>

<div class="card">
	<Table.Root>
		<Table.Header>
			<Table.Row>
				<Table.Head>Financial year</Table.Head>
				<Table.Head class="text-right">Cash distribution</Table.Head>
				<Table.Head class="text-right">Attribution</Table.Head>
				<Table.Head class="text-right">Cost base adj.</Table.Head>
				<Table.Head class="text-right">Units at close</Table.Head>
				<Table.Head class="text-right">Actions</Table.Head>
			</Table.Row>
		</Table.Header>
		<Table.Body>
			{#each offerableYears as fy (fy)}
				{@const forYear = amitStatements.filter((s) => s.financialYear === fy)}
				<!--
					A year usually has one statement. It has two when the holding moved broker
					mid-year: each registry issues its own against its own HIN, and both go on
					the return, so both get a row.
				-->
				{#each forYear.length > 0 ? forYear : [null] as stmt, i (stmt?.id ?? `none-${fy}`)}
					{@const annual = annualStatements.find(
						(a) =>
							a.financialYear === fy &&
							(forYear.length > 1 ? a.holderNumber === stmt?.holderNumber : true)
					)}
					<Table.Row>
						<Table.Cell class="font-medium">
							{i === 0 ? financialYearLabel(fy) : ''}
							{#if stmt && forYear.length > 1}
								<span class="ml-1 text-[11px] font-normal text-muted-foreground">
									···{stmt.holderNumber}
								</span>
							{/if}
						</Table.Cell>
						{#if stmt}
							{@const adj = netCostBaseAmount(stmt)}
							<Table.Cell class="text-right tabular-nums"
								>{formatCurrency(stmt.grossCashDistribution)}</Table.Cell
							>
							<Table.Cell class="text-right tabular-nums"
								>{formatCurrency(stmt.grossAttribution)}</Table.Cell
							>
							<Table.Cell
								class="text-right tabular-nums {adj === 0
									? ''
									: adj < 0
										? 'text-loss'
										: 'text-gain'}"
							>
								{adj > 0 ? '+' : ''}{formatCurrency(adj)}
							</Table.Cell>
							<Table.Cell class="text-right text-muted-foreground tabular-nums">
								{annual?.closingUnits ?? '—'}
							</Table.Cell>
							<Table.Cell class="text-right">
								<div class="flex items-center justify-end gap-1">
									{#if annual}
										<DocumentAttachment
											owner="annualStatement"
											ownerId={annual.id}
											documents={annual.documents}
											readOnly
										/>
									{/if}
									<DocumentAttachment
										owner="amitStatement"
										ownerId={stmt.id}
										documents={stmt.documents}
										readOnly
									/>
									<Button
										variant="ghost"
										size="sm"
										href={resolve(
											'/(dashboard)/portfolios/[portfolioId]/[holdingId]/tax-statement/[financialYear]',
											{ portfolioId, holdingId, financialYear: String(fy) }
										) + (stmt.holderNumber ? `?holder=${stmt.holderNumber}` : '')}>Edit</Button
									>
								</div>
							</Table.Cell>
						{:else}
							<Table.Cell colspan={3} class="text-muted-foreground">Not entered</Table.Cell>
							<Table.Cell class="text-right text-muted-foreground tabular-nums">
								{annual?.closingUnits ?? '—'}
							</Table.Cell>
							<Table.Cell class="text-right">
								{#if annual}
									<DocumentAttachment
										owner="annualStatement"
										ownerId={annual.id}
										documents={annual.documents}
										readOnly
									/>
								{/if}
								<Button
									variant="ghost"
									size="sm"
									href={resolve(
										'/(dashboard)/portfolios/[portfolioId]/[holdingId]/tax-statement/[financialYear]',
										{ portfolioId, holdingId, financialYear: String(fy) }
									)}>Add</Button
								>
							</Table.Cell>
						{/if}
					</Table.Row>
				{/each}
			{/each}
		</Table.Body>
	</Table.Root>
</div>
