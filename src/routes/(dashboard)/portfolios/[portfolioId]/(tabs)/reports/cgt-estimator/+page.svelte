<script lang="ts">
	import { registerReport } from '#lib/report-chrome.svelte.js';
	import { getPortfolioTaxSummary } from '#lib/remotes/portfolio.remote.js';
	import { page } from '$app/state';
	import * as Table from '$ui/table';
	import * as Select from '$ui/select';
	import Input from '$ui/input/input.svelte';
	import Button from '$ui/button/button.svelte';
	import SummaryCard from '#lib/components/summary-card.svelte';
	import { formatCurrency, downloadCSV } from '#lib/utils.js';
	import { calculateCGT } from '#lib/utils/cgt-calculations.js';
	import { simulateSale } from '#lib/utils/sale-simulation.js';

	const portfolioId = page.params.portfolioId!;
	/* Always the current year: the question is what selling today would add. */
	const taxSummary = $derived(await getPortfolioTaxSummary({ id: portfolioId }));

	/*
	  Resident marginal rates for 2025-26, each with the 2% Medicare levy already
	  added — the levy applies to a capital gain like any other income, so quoting
	  the bare rate would understate the bill.
	*/
	const MARGINAL_RATES = [
		{ value: 0, band: 'Up to $18,200' },
		{ value: 18, band: '$18,201 to $45,000' },
		{ value: 32, band: '$45,001 to $135,000' },
		{ value: 39, band: '$135,001 to $190,000' },
		{ value: 47, band: 'Over $190,000' }
	];
	let marginalRate = $state(32);
	const rateBand = $derived(MARGINAL_RATES.find((r) => r.value === marginalRate)?.band ?? '');
	const taxOn = (assessable: number) => Math.round(assessable * (marginalRate / 100));

	/* What the year has realised already. */
	const realised = $derived(taxSummary.cgtCalculation);
	const realisedTax = $derived(taxOn(realised.totalTaxableGain));
	const realisedDisposals = $derived(
		taxSummary.currentFY.shortTermGains.length +
			taxSummary.currentFY.longTermGains.length +
			taxSummary.currentFY.capitalLosses.length
	);

	/* The hypothetical sale, in units per holding. */
	let unitsToSell = $state<Record<string, number>>({});

	const modelledByHolding = $derived(
		taxSummary.holdings.map((holding) => {
			const units = unitsToSell[holding.id] ?? 0;
			const lots = taxSummary.unrealisedLots.filter((lot) => lot.holdingId === holding.id);
			return { holding, units, sale: simulateSale(lots, units) };
		})
	);

	const modelled = $derived(
		modelledByHolding.reduce(
			(total, { sale }) => ({
				units: total.units + sale.units,
				proceeds: total.proceeds + sale.proceeds,
				costBase: total.costBase + sale.costBase,
				shortTermGains: total.shortTermGains + sale.shortTermGains,
				longTermGains: total.longTermGains + sale.longTermGains,
				capitalLosses: total.capitalLosses + sale.capitalLosses,
				netGain: total.netGain + sale.netGain
			}),
			{
				units: 0,
				proceeds: 0,
				costBase: 0,
				shortTermGains: 0,
				longTermGains: 0,
				capitalLosses: 0,
				netGain: 0
			}
		)
	);

	const anythingModelled = $derived(modelled.units > 0);

	/*
	  Net the whole year at once rather than taxing the sale on its own. A loss already
	  realised absorbs the new gain before the discount is applied, so a sale costed in
	  isolation can be wrong in both directions.
	*/
	const combined = $derived(
		calculateCGT(
			realised.shortTermGains + modelled.shortTermGains,
			realised.longTermGains + modelled.longTermGains,
			Math.abs(taxSummary.currentFY.totalCapitalLosses) + modelled.capitalLosses
		)
	);
	const combinedTax = $derived(taxOn(combined.totalTaxableGain));

	const addedAssessable = $derived(combined.totalTaxableGain - realised.totalTaxableGain);
	const addedTax = $derived(combinedTax - realisedTax);

	function clear() {
		unitsToSell = {};
	}

	function setUnits(holdingId: string, value: number, max: number) {
		unitsToSell = { ...unitsToSell, [holdingId]: Math.max(0, Math.min(value, max)) };
	}

	/* Negating a zero would otherwise print as -$0.00 down the deduction rows. */
	const money = (cents: number) => formatCurrency(cents === 0 ? 0 : cents);

	const dollars = (cents: number) => (cents / 100).toFixed(2);

	function generateEstimate() {
		let csv = `CGT estimate - ${taxSummary.currentFY.label}\n`;
		csv += `Marginal rate,${marginalRate}%\n\n`;

		if (anythingModelled) {
			csv += 'Modelled sale\n';
			csv += 'Holding,Code,Units,Proceeds,Cost base,Gain\n';
			for (const { holding, units, sale } of modelledByHolding) {
				if (units <= 0) continue;
				csv += `${holding.name},${holding.code},${sale.units},${dollars(sale.proceeds)},${dollars(sale.costBase)},${dollars(sale.netGain)}\n`;
			}
			csv += `Total,,${modelled.units},${dollars(modelled.proceeds)},${dollars(modelled.costBase)},${dollars(modelled.netGain)}\n\n`;
		}

		csv += 'Position,Realised,Added by the sale,Total\n';
		const row = (label: string, a: number, b: number, c: number) => {
			csv += `${label},${dollars(a)},${dollars(b)},${dollars(c)}\n`;
		};
		row(
			'Short-term gains',
			realised.shortTermGains,
			modelled.shortTermGains,
			combined.shortTermGains
		);
		row('Long-term gains', realised.longTermGains, modelled.longTermGains, combined.longTermGains);
		row(
			'Capital losses',
			-Math.abs(taxSummary.currentFY.totalCapitalLosses),
			-modelled.capitalLosses,
			-(Math.abs(taxSummary.currentFY.totalCapitalLosses) + modelled.capitalLosses)
		);
		row(
			'Losses applied',
			-(realised.lossesAppliedToShortTerm + realised.lossesAppliedToLongTerm),
			-(
				combined.lossesAppliedToShortTerm +
				combined.lossesAppliedToLongTerm -
				realised.lossesAppliedToShortTerm -
				realised.lossesAppliedToLongTerm
			),
			-(combined.lossesAppliedToShortTerm + combined.lossesAppliedToLongTerm)
		);
		row(
			'CGT discount',
			-realised.cgtDiscount,
			-(combined.cgtDiscount - realised.cgtDiscount),
			-combined.cgtDiscount
		);
		row(
			'Assessable capital gain',
			realised.totalTaxableGain,
			addedAssessable,
			combined.totalTaxableGain
		);
		row(`Estimated tax at ${marginalRate}%`, realisedTax, addedTax, combinedTax);

		downloadCSV(csv, `CGT-estimate-${taxSummary.currentFY.label}`);
	}

	registerReport(() => ({
		title: 'CGT estimator',
		subtitle: `${taxSummary.currentFY.label} · what you have realised, and what selling more would add`,
		csv: generateEstimate
	}));
</script>

<section class="mb-8">
	<h2 class="mb-3 text-base font-semibold">This year so far</h2>
	<div class="grid gap-4 md:grid-cols-4">
		<SummaryCard label="Assessable capital gain" value={formatCurrency(realised.totalTaxableGain)}>
			<p class="mt-1 text-xs text-muted-foreground">After losses and the 50% discount</p>
		</SummaryCard>
		<SummaryCard label="Estimated tax" value={formatCurrency(realisedTax)}>
			<p class="mt-1 text-xs text-muted-foreground">At {marginalRate}% · {rateBand}</p>
		</SummaryCard>
		<SummaryCard label="Disposals" value={String(realisedDisposals)}>
			<p class="mt-1 text-xs text-muted-foreground">
				Sales settled in {taxSummary.currentFY.label}
			</p>
		</SummaryCard>
		<div class="rounded-md border border-border bg-card px-3.5 py-3 print:hidden">
			<p class="text-[11px] font-medium text-muted-foreground">Marginal tax rate</p>
			<Select.Root
				type="single"
				value={String(marginalRate)}
				onValueChange={(v) => v && (marginalRate = Number(v))}
			>
				<Select.Trigger class="mt-1.5 w-full" aria-label="Marginal tax rate">
					{marginalRate}% including Medicare levy
				</Select.Trigger>
				<Select.Content>
					{#each MARGINAL_RATES as rate (rate.value)}
						<Select.Item value={String(rate.value)}>{rate.value}% · {rate.band}</Select.Item>
					{/each}
				</Select.Content>
			</Select.Root>
		</div>
	</div>
</section>

<section class="mb-8">
	<div class="mb-2 flex items-baseline justify-between gap-3">
		<div class="flex items-baseline gap-2">
			<h2 class="text-base font-semibold">Model a sale</h2>
			<span class="text-[11px] text-muted-foreground">
				Oldest parcels go first · nothing here is saved
			</span>
		</div>
		{#if anythingModelled}
			<Button variant="ghost" size="sm" onclick={clear} class="print:hidden">Clear all</Button>
		{/if}
	</div>

	{#if taxSummary.holdings.length === 0}
		<div class="card py-8 text-center text-[13px] text-muted-foreground">
			No holdings to sell. Add a holding to estimate a disposal.
		</div>
	{:else}
		<div class="card">
			<Table.Root>
				<Table.Header>
					<Table.Row>
						<Table.Head>Holding</Table.Head>
						<Table.Head class="text-right">Price</Table.Head>
						<Table.Head class="text-right">Units held</Table.Head>
						<Table.Head class="text-right">Units to sell</Table.Head>
						<Table.Head class="text-right">Proceeds</Table.Head>
						<Table.Head class="text-right">Cost base</Table.Head>
						<Table.Head class="text-right">Gain</Table.Head>
					</Table.Row>
				</Table.Header>
				<Table.Body>
					{#each modelledByHolding as { holding, units, sale } (holding.id)}
						<Table.Row>
							<Table.Cell>
								<p class="font-medium">{holding.code}</p>
								<p class="text-[11px] text-muted-foreground">{holding.name}</p>
							</Table.Cell>
							<Table.Cell class="text-right">{formatCurrency(holding.currentPrice)}</Table.Cell>
							<Table.Cell class="text-right">{holding.units}</Table.Cell>
							<Table.Cell class="text-right">
								<div class="flex items-center justify-end gap-1.5">
									<Input
										type="number"
										min="0"
										max={holding.units}
										placeholder="0"
										value={units || ''}
										oninput={(e) =>
											setUnits(holding.id, parseInt(e.currentTarget.value) || 0, holding.units)}
										class="h-8 w-24 text-right"
										aria-label="Units of {holding.code} to sell"
									/>
									<Button
										variant="ghost"
										size="sm"
										class="print:hidden"
										onclick={() => setUnits(holding.id, holding.units, holding.units)}
									>
										All
									</Button>
								</div>
							</Table.Cell>
							<Table.Cell class="text-right">
								{units > 0 ? formatCurrency(sale.proceeds) : '—'}
							</Table.Cell>
							<Table.Cell class="text-right">
								{units > 0 ? formatCurrency(sale.costBase) : '—'}
							</Table.Cell>
							<Table.Cell class="text-right {sale.netGain < 0 ? 'text-loss' : ''}">
								{units > 0 ? formatCurrency(sale.netGain) : '—'}
							</Table.Cell>
						</Table.Row>
					{/each}
				</Table.Body>
				{#if anythingModelled}
					<Table.Footer>
						<Table.Row>
							<Table.Cell colspan={3} class="font-medium">Total</Table.Cell>
							<Table.Cell class="text-right font-semibold">{modelled.units}</Table.Cell>
							<Table.Cell class="text-right font-semibold">
								{formatCurrency(modelled.proceeds)}
							</Table.Cell>
							<Table.Cell class="text-right font-semibold">
								{formatCurrency(modelled.costBase)}
							</Table.Cell>
							<Table.Cell
								class="text-right font-semibold {modelled.netGain < 0 ? 'text-loss' : ''}"
							>
								{formatCurrency(modelled.netGain)}
							</Table.Cell>
						</Table.Row>
					</Table.Footer>
				{/if}
			</Table.Root>
		</div>
	{/if}
</section>

<!--
	One row of the ledger: what the year has realised, what the modelled sale adds,
	and where the two land together.
-->
{#snippet ledgerRow(
	label: string,
	realisedAmount: number,
	added: number,
	total: number,
	hint?: string
)}
	<Table.Row>
		<Table.Cell>
			{label}
			{#if hint}
				<span class="ml-1.5 text-[11px] text-muted-foreground">{hint}</span>
			{/if}
		</Table.Cell>
		<Table.Cell class="text-right">{money(realisedAmount)}</Table.Cell>
		<Table.Cell class="text-right {added === 0 ? 'text-muted-foreground' : ''}">
			{added === 0 ? '—' : money(added)}
		</Table.Cell>
		<Table.Cell class="text-right">{money(total)}</Table.Cell>
	</Table.Row>
{/snippet}

<section class="mb-8">
	<div class="mb-2 flex items-baseline gap-2">
		<h2 class="text-base font-semibold">Where that leaves you</h2>
		<span class="text-[11px] text-muted-foreground">
			The whole year netted together, not the sale on its own
		</span>
	</div>

	<div class="card">
		<Table.Root>
			<Table.Header>
				<Table.Row>
					<Table.Head></Table.Head>
					<Table.Head class="text-right">Realised</Table.Head>
					<Table.Head class="text-right">Added by the sale</Table.Head>
					<Table.Head class="text-right">Total</Table.Head>
				</Table.Row>
			</Table.Header>
			<Table.Body>
				{@render ledgerRow(
					'Short-term gains',
					realised.shortTermGains,
					modelled.shortTermGains,
					combined.shortTermGains,
					'held 12 months or less'
				)}
				{@render ledgerRow(
					'Long-term gains',
					realised.longTermGains,
					modelled.longTermGains,
					combined.longTermGains,
					'discount eligible'
				)}
				{@render ledgerRow(
					'Capital losses',
					-Math.abs(taxSummary.currentFY.totalCapitalLosses),
					-modelled.capitalLosses,
					-(Math.abs(taxSummary.currentFY.totalCapitalLosses) + modelled.capitalLosses)
				)}
				{@render ledgerRow(
					'Losses applied',
					-(realised.lossesAppliedToShortTerm + realised.lossesAppliedToLongTerm),
					-(
						combined.lossesAppliedToShortTerm +
						combined.lossesAppliedToLongTerm -
						realised.lossesAppliedToShortTerm -
						realised.lossesAppliedToLongTerm
					),
					-(combined.lossesAppliedToShortTerm + combined.lossesAppliedToLongTerm),
					'short-term first'
				)}
				{@render ledgerRow(
					'CGT discount',
					-realised.cgtDiscount,
					-(combined.cgtDiscount - realised.cgtDiscount),
					-combined.cgtDiscount,
					'50% on long-term gains'
				)}
			</Table.Body>
			<Table.Footer>
				<Table.Row>
					<Table.Cell class="font-medium">Assessable capital gain</Table.Cell>
					<Table.Cell class="text-right font-semibold">
						{money(realised.totalTaxableGain)}
					</Table.Cell>
					<Table.Cell class="text-right font-semibold">
						{addedAssessable === 0 ? '—' : money(addedAssessable)}
					</Table.Cell>
					<Table.Cell class="text-right font-semibold">
						{money(combined.totalTaxableGain)}
					</Table.Cell>
				</Table.Row>
				<Table.Row>
					<Table.Cell class="font-medium">Estimated tax at {marginalRate}%</Table.Cell>
					<Table.Cell class="text-right font-semibold">{money(realisedTax)}</Table.Cell>
					<Table.Cell class="text-right font-semibold">
						{addedTax === 0 ? '—' : money(addedTax)}
					</Table.Cell>
					<Table.Cell class="text-right font-semibold">{money(combinedTax)}</Table.Cell>
				</Table.Row>
			</Table.Footer>
		</Table.Root>
	</div>

	{#if anythingModelled}
		<p class="mt-3 rounded-md border border-primary/30 bg-primary/10 px-3.5 py-3 text-[13px]">
			Selling {modelled.units} units adds
			<strong>{money(addedAssessable)}</strong> to your assessable income — about
			<strong>{money(addedTax)}</strong> in tax at {marginalRate}%, leaving
			{money(modelled.proceeds - addedTax)} of the {money(modelled.proceeds)} proceeds.
		</p>
	{:else}
		<p class="mt-3 text-[13px] text-muted-foreground">
			Enter units above to see what a sale would add.
		</p>
	{/if}

	{#if combined.lossesCarriedForward > 0}
		<p class="mt-2 text-[13px] text-muted-foreground">
			{money(combined.lossesCarriedForward)} of capital losses would be left over and carried forward
			to a later year.
		</p>
	{/if}
</section>

<p class="text-[11px] text-muted-foreground">
	An estimate on this portfolio alone, at a marginal rate you choose. It does not know about gains
	elsewhere, losses carried in from earlier years, or your other income.
</p>
