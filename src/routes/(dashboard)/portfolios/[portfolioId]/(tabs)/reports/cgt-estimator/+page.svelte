<script lang="ts">
	import { registerReport } from '#lib/report-chrome.svelte.js';
	import { getPortfolioTaxSummary } from '#lib/remotes/portfolio.remote.js';
	import { page } from '$app/state';
	import * as Table from '$ui/table';
	import * as NativeSelect from '$ui/native-select';
	import Input from '$ui/input/input.svelte';
	import Button from '$ui/button/button.svelte';
	import { formatCurrency, downloadCSV } from '#lib/utils.js';

	const portfolioId = page.params.portfolioId!;
	const taxSummary = $derived(await getPortfolioTaxSummary({ id: portfolioId }));

	// Tax rate options (Australian marginal rates)
	const taxRates = [
		{ label: '0% (Tax-free threshold)', value: 0 },
		{ label: '19% ($18,201 - $45,000)', value: 19 },
		{ label: '32.5% ($45,001 - $120,000)', value: 32.5 },
		{ label: '37% ($120,001 - $180,000)', value: 37 },
		{ label: '45% ($180,001+)', value: 45 }
	];

	let selectedTaxRate = $state(32.5);

	// Estimated tax based on selected rate
	const estimatedTax = $derived(
		taxSummary.cgtCalculation.totalTaxableGain > 0
			? taxSummary.cgtCalculation.totalTaxableGain * (selectedTaxRate / 100)
			: 0
	);

	// Mock sale simulator state - track units to sell per holding
	let unitsToSellByHolding = $state<Record<string, number>>({});

	// Calculate mock sale for a single holding using FIFO
	function calculateMockSale(holdingId: string, unitsToSell: number) {
		if (unitsToSell <= 0) return null;

		const holdingLots = taxSummary.unrealisedLots
			.filter((lot) => lot.holdingId === holdingId)
			.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

		let remainingToSell = unitsToSell;
		let shortTermGain = 0;
		let longTermGain = 0;
		let totalProceeds = 0;
		let totalCostBase = 0;

		for (const lot of holdingLots) {
			if (remainingToSell <= 0) break;

			const quantityFromLot = Math.min(lot.quantity, remainingToSell);
			const proceeds = quantityFromLot * lot.currentPrice;
			const costBase = quantityFromLot * lot.costPerUnit;
			const gain = proceeds - costBase;

			totalProceeds += proceeds;
			totalCostBase += costBase;

			if (lot.isLongTerm) {
				longTermGain += gain;
			} else {
				shortTermGain += gain;
			}

			remainingToSell -= quantityFromLot;
		}

		const totalGain = shortTermGain + longTermGain;
		const taxableShortTerm = shortTermGain;
		const taxableLongTerm = longTermGain > 0 ? longTermGain * 0.5 : longTermGain;
		const totalTaxableGain = taxableShortTerm + taxableLongTerm;
		const estimatedTax = totalTaxableGain > 0 ? totalTaxableGain * (selectedTaxRate / 100) : 0;

		return {
			unitsToSell: unitsToSell - remainingToSell,
			shortTermGain,
			longTermGain,
			totalGain,
			totalProceeds,
			totalCostBase,
			taxableShortTerm,
			taxableLongTerm,
			totalTaxableGain,
			estimatedTax
		};
	}

	// Combined mock sale results across all holdings
	const combinedMockSale = $derived.by(() => {
		let totalShortTermGain = 0;
		let totalLongTermGain = 0;
		let totalProceeds = 0;
		let totalCostBase = 0;
		let totalUnits = 0;

		for (const holding of taxSummary.holdings) {
			const units = unitsToSellByHolding[holding.id] || 0;
			if (units > 0) {
				const result = calculateMockSale(holding.id, units);
				if (result) {
					totalShortTermGain += result.shortTermGain;
					totalLongTermGain += result.longTermGain;
					totalProceeds += result.totalProceeds;
					totalCostBase += result.totalCostBase;
					totalUnits += result.unitsToSell;
				}
			}
		}

		if (totalUnits === 0) return null;

		const totalGain = totalShortTermGain + totalLongTermGain;
		const taxableShortTerm = totalShortTermGain;
		const taxableLongTerm = totalLongTermGain > 0 ? totalLongTermGain * 0.5 : totalLongTermGain;
		const totalTaxableGain = taxableShortTerm + taxableLongTerm;
		const estimatedTax = totalTaxableGain > 0 ? totalTaxableGain * (selectedTaxRate / 100) : 0;

		return {
			totalUnits,
			shortTermGain: totalShortTermGain,
			longTermGain: totalLongTermGain,
			totalGain,
			totalProceeds,
			totalCostBase,
			taxableShortTerm,
			taxableLongTerm,
			totalTaxableGain,
			estimatedTax
		};
	});

	const formatDate = (date: Date | string) => {
		return new Date(date).toLocaleDateString('en-AU', {
			year: 'numeric',
			month: 'short',
			day: 'numeric'
		});
	};

	function generateCGTReport() {
		// CSV Header
		let csv = 'CGT Report - ' + taxSummary.currentFY.label + '\n\n';

		// Short-Term Gains
		csv += 'Short-Term Gains (Held ≤ 12 months)\n';
		csv += 'Sale Date,Holding,Code,Units,Proceeds,Cost Base,Gain\n';
		taxSummary.currentFY.shortTermGains.forEach((gain) => {
			csv += `${formatDate(gain.saleDate)},${gain.holdingName},${gain.holdingCode},${gain.quantity},${(gain.proceeds / 100).toFixed(2)},${(gain.costBase / 100).toFixed(2)},${(gain.gain / 100).toFixed(2)}\n`;
		});
		csv += `Total,,,${taxSummary.currentFY.totalShortTermUnits},${(taxSummary.currentFY.totalShortTermProceeds / 100).toFixed(2)},,${(taxSummary.currentFY.totalShortTermGains / 100).toFixed(2)}\n\n`;

		// Long-Term Gains
		csv += 'Long-Term Gains (Held > 12 months - 50% discount eligible)\n';
		csv += 'Sale Date,Holding,Code,Units,Proceeds,Cost Base,Gain\n';
		taxSummary.currentFY.longTermGains.forEach((gain) => {
			csv += `${formatDate(gain.saleDate)},${gain.holdingName},${gain.holdingCode},${gain.quantity},${(gain.proceeds / 100).toFixed(2)},${(gain.costBase / 100).toFixed(2)},${(gain.gain / 100).toFixed(2)}\n`;
		});
		csv += `Total,,,${taxSummary.currentFY.totalLongTermUnits},${(taxSummary.currentFY.totalLongTermProceeds / 100).toFixed(2)},,${(taxSummary.currentFY.totalLongTermGains / 100).toFixed(2)}\n\n`;

		// Capital Losses
		csv += 'Capital Losses (Offset against gains)\n';
		csv += 'Sale Date,Holding,Code,Units,Proceeds,Cost Base,Loss\n';
		taxSummary.currentFY.capitalLosses.forEach((loss) => {
			csv += `${formatDate(loss.saleDate)},${loss.holdingName},${loss.holdingCode},${loss.quantity},${(loss.proceeds / 100).toFixed(2)},${(loss.costBase / 100).toFixed(2)},${(loss.gain / 100).toFixed(2)}\n`;
		});
		csv += `Total,,,${taxSummary.currentFY.totalCapitalLossUnits},${(taxSummary.currentFY.totalCapitalLossProceeds / 100).toFixed(2)},,${(taxSummary.currentFY.totalCapitalLosses / 100).toFixed(2)}\n\n`;

		// CGT Summary
		csv += 'CGT Calculation Summary\n';
		csv += 'Description,Amount\n';
		csv += `Short-Term Gains,${(taxSummary.cgtCalculation.shortTermGains / 100).toFixed(2)}\n`;
		csv += `Less: Capital Losses Offset,${(-taxSummary.cgtCalculation.lossesAppliedToShortTerm / 100).toFixed(2)}\n`;
		csv += `Short-Term After Losses,${(taxSummary.cgtCalculation.shortTermAfterLosses / 100).toFixed(2)}\n`;
		csv += `Long-Term Gains,${(taxSummary.cgtCalculation.longTermGains / 100).toFixed(2)}\n`;
		csv += `Less: Capital Losses Offset,${(-taxSummary.cgtCalculation.lossesAppliedToLongTerm / 100).toFixed(2)}\n`;
		csv += `Long-Term After Losses,${(taxSummary.cgtCalculation.longTermAfterLosses / 100).toFixed(2)}\n`;
		csv += `Less: CGT Discount (50%),${(-taxSummary.cgtCalculation.cgtDiscount / 100).toFixed(2)}\n`;
		csv += `Long-Term Taxable,${(taxSummary.cgtCalculation.longTermTaxable / 100).toFixed(2)}\n`;
		csv += `Total Taxable Capital Gain,${(taxSummary.cgtCalculation.totalTaxableGain / 100).toFixed(2)}\n`;

		downloadCSV(csv, `CGT-Report-${taxSummary.currentFY.label}`);
	}

	registerReport(() => ({
		title: 'CGT estimator',
		subtitle: `${taxSummary.currentFY.label} · what you have realised so far, and what selling more would add`,
		csv: generateCGTReport
	}));
</script>

<!-- Short-Term Gains Table -->
<div class="mb-8">
	<div class="mb-4 flex items-center justify-between">
		<h2 class="text-base font-semibold">Short-Term Gains</h2>
		<div class="text-right">
			<p class="text-xl font-bold">
				{formatCurrency(taxSummary.currentFY.totalShortTermGains)}
			</p>
			<p class="text-xs text-muted-foreground">Held ≤ 12 months</p>
		</div>
	</div>

	{#if taxSummary.currentFY.shortTermGains.length > 0}
		<div class="card">
			<Table.Root>
				<Table.Header>
					<Table.Row>
						<Table.Head>Sale Date</Table.Head>
						<Table.Head>Holding</Table.Head>
						<Table.Head class="text-right">Units</Table.Head>
						<Table.Head class="text-right">Proceeds</Table.Head>
						<Table.Head class="text-right">Cost Base</Table.Head>
						<Table.Head class="text-right">Gain</Table.Head>
					</Table.Row>
				</Table.Header>
				<Table.Body>
					{#each taxSummary.currentFY.shortTermGains as gain, i (i)}
						<Table.Row>
							<Table.Cell>{formatDate(gain.saleDate)}</Table.Cell>
							<Table.Cell class="font-medium">{gain.holdingName} ({gain.holdingCode})</Table.Cell>
							<Table.Cell class="text-right">{gain.quantity}</Table.Cell>
							<Table.Cell class="text-right">{formatCurrency(gain.proceeds)}</Table.Cell>
							<Table.Cell class="text-right">{formatCurrency(gain.costBase)}</Table.Cell>
							<Table.Cell class="text-right ">
								{formatCurrency(gain.gain)}
							</Table.Cell>
						</Table.Row>
					{/each}
				</Table.Body>
				<Table.Footer>
					<Table.Row>
						<Table.Cell colspan={2} class="font-medium">Total</Table.Cell>
						<Table.Cell class="text-right font-bold">
							{taxSummary.currentFY.totalShortTermUnits}
						</Table.Cell>
						<Table.Cell class="text-right font-bold">
							{formatCurrency(taxSummary.currentFY.totalShortTermProceeds)}
						</Table.Cell>
						<Table.Cell></Table.Cell>
						<Table.Cell class="text-right font-bold">
							{formatCurrency(taxSummary.currentFY.totalShortTermGains)}
						</Table.Cell>
					</Table.Row>
				</Table.Footer>
			</Table.Root>
		</div>
	{:else}
		<div class="card py-8 text-center text-muted-foreground">
			No short-term gains in {taxSummary.currentFY.label}.
		</div>
	{/if}
</div>

<!-- Long-Term Gains Table -->
<div class="mb-8">
	<div class="mb-4 flex items-center justify-between">
		<h2 class="text-base font-semibold">Long-Term Gains</h2>
		<div class="text-right">
			<p class="text-xl font-bold">
				{formatCurrency(taxSummary.currentFY.totalLongTermGains)}
			</p>
			<p class="text-xs text-muted-foreground">Held &gt; 12 months (50% discount eligible)</p>
		</div>
	</div>

	{#if taxSummary.currentFY.longTermGains.length > 0}
		<div class="card">
			<Table.Root>
				<Table.Header>
					<Table.Row>
						<Table.Head>Sale Date</Table.Head>
						<Table.Head>Holding</Table.Head>
						<Table.Head class="text-right">Units</Table.Head>
						<Table.Head class="text-right">Proceeds</Table.Head>
						<Table.Head class="text-right">Cost Base</Table.Head>
						<Table.Head class="text-right">Gain</Table.Head>
					</Table.Row>
				</Table.Header>
				<Table.Body>
					{#each taxSummary.currentFY.longTermGains as gain, i (i)}
						<Table.Row>
							<Table.Cell>{formatDate(gain.saleDate)}</Table.Cell>
							<Table.Cell class="font-medium">{gain.holdingName} ({gain.holdingCode})</Table.Cell>
							<Table.Cell class="text-right">{gain.quantity}</Table.Cell>
							<Table.Cell class="text-right">{formatCurrency(gain.proceeds)}</Table.Cell>
							<Table.Cell class="text-right">{formatCurrency(gain.costBase)}</Table.Cell>
							<Table.Cell class="text-right ">
								{formatCurrency(gain.gain)}
							</Table.Cell>
						</Table.Row>
					{/each}
				</Table.Body>
				<Table.Footer>
					<Table.Row>
						<Table.Cell colspan={2} class="font-medium">Total</Table.Cell>
						<Table.Cell class="text-right font-bold">
							{taxSummary.currentFY.totalLongTermUnits}
						</Table.Cell>
						<Table.Cell class="text-right font-bold">
							{formatCurrency(taxSummary.currentFY.totalLongTermProceeds)}
						</Table.Cell>
						<Table.Cell></Table.Cell>
						<Table.Cell class="text-right font-bold">
							{formatCurrency(taxSummary.currentFY.totalLongTermGains)}
						</Table.Cell>
					</Table.Row>
				</Table.Footer>
			</Table.Root>
		</div>
	{:else}
		<div class="card py-8 text-center text-muted-foreground">
			No long-term gains in {taxSummary.currentFY.label}.
		</div>
	{/if}
</div>

<!-- Capital Losses Table -->
<div class="mb-8">
	<div class="mb-4 flex items-center justify-between">
		<h2 class="text-base font-semibold">Capital Losses</h2>
		<div class="text-right">
			<p class="text-xl font-bold text-loss">
				{formatCurrency(taxSummary.currentFY.totalCapitalLosses)}
			</p>
			<p class="text-xs text-muted-foreground">Offset against gains</p>
		</div>
	</div>

	{#if taxSummary.currentFY.capitalLosses.length > 0}
		<div class="card">
			<Table.Root>
				<Table.Header>
					<Table.Row>
						<Table.Head>Sale Date</Table.Head>
						<Table.Head>Holding</Table.Head>
						<Table.Head class="text-right">Units</Table.Head>
						<Table.Head class="text-right">Proceeds</Table.Head>
						<Table.Head class="text-right">Cost Base</Table.Head>
						<Table.Head class="text-right">Loss</Table.Head>
					</Table.Row>
				</Table.Header>
				<Table.Body>
					{#each taxSummary.currentFY.capitalLosses as loss, i (i)}
						<Table.Row>
							<Table.Cell>{formatDate(loss.saleDate)}</Table.Cell>
							<Table.Cell class="font-medium">{loss.holdingName} ({loss.holdingCode})</Table.Cell>
							<Table.Cell class="text-right">{loss.quantity}</Table.Cell>
							<Table.Cell class="text-right">{formatCurrency(loss.proceeds)}</Table.Cell>
							<Table.Cell class="text-right">{formatCurrency(loss.costBase)}</Table.Cell>
							<Table.Cell class="text-right text-loss">
								{formatCurrency(loss.gain)}
							</Table.Cell>
						</Table.Row>
					{/each}
				</Table.Body>
				<Table.Footer>
					<Table.Row>
						<Table.Cell colspan={2} class="font-medium">Total</Table.Cell>
						<Table.Cell class="text-right font-bold">
							{taxSummary.currentFY.totalCapitalLossUnits}
						</Table.Cell>
						<Table.Cell class="text-right font-bold">
							{formatCurrency(taxSummary.currentFY.totalCapitalLossProceeds)}
						</Table.Cell>
						<Table.Cell></Table.Cell>
						<Table.Cell class="text-right font-bold text-loss">
							{formatCurrency(taxSummary.currentFY.totalCapitalLosses)}
						</Table.Cell>
					</Table.Row>
				</Table.Footer>
			</Table.Root>
		</div>
	{:else}
		<div class="card py-8 text-center text-muted-foreground">
			No capital losses in {taxSummary.currentFY.label}.
		</div>
	{/if}
</div>

<!-- CGT Summary -->
<div class="mb-8">
	<h2 class="mb-3 text-base font-semibold">Summary</h2>
	<p class="mb-4 text-sm text-muted-foreground">
		Capital losses are first offset against short-term gains, then long-term gains. Long-term gains
		receive a 50% CGT discount.
	</p>

	<div class="card">
		<!-- Short-Term Section -->
		<div class="mb-6">
			<h3 class="mb-3 font-semibold">
				Capital Gains on shares applicable for 'Other' method (short-term gains)
			</h3>
			<div class="space-y-2 text-sm">
				<div class="flex justify-between">
					<span>Short Term Gains</span>
					<span>{formatCurrency(taxSummary.cgtCalculation.shortTermGains)}</span>
				</div>
				<div class="flex justify-between border-b pb-2">
					<span class="italic">less Capital losses available to offset</span>
					<span class="text-loss"
						>{formatCurrency(-taxSummary.cgtCalculation.lossesAppliedToShortTerm)}</span
					>
				</div>
				<div class="flex justify-between font-medium">
					<span></span>
					<span>{formatCurrency(taxSummary.cgtCalculation.shortTermAfterLosses)}</span>
				</div>
			</div>
		</div>

		<!-- Long-Term Section -->
		<div class="mb-6">
			<h3 class="mb-3 font-semibold">
				Capital Gains on shares applicable for 'Discount' method (long-term gains)
			</h3>
			<div class="space-y-2 text-sm">
				<div class="flex justify-between">
					<span>Long Term Gains</span>
					<span>{formatCurrency(taxSummary.cgtCalculation.longTermGains)}</span>
				</div>
				<div class="flex justify-between border-b pb-2">
					<span class="italic">less Capital losses available to offset</span>
					<span class="text-loss"
						>{formatCurrency(-taxSummary.cgtCalculation.lossesAppliedToLongTerm)}</span
					>
				</div>
				<div class="flex justify-between">
					<span></span>
					<span>{formatCurrency(taxSummary.cgtCalculation.longTermAfterLosses)}</span>
				</div>
				<div class="flex justify-between border-b pb-2">
					<span class="italic">less CGT Concession Amount @ 50%</span>
					<span class="text-loss">{formatCurrency(-taxSummary.cgtCalculation.cgtDiscount)}</span>
				</div>
			</div>
		</div>

		<!-- Total -->
		<div class="border-t-2 border-foreground pt-4">
			<div class="flex justify-between text-lg font-bold">
				<span>Capital Gain</span>
				<span>{formatCurrency(taxSummary.cgtCalculation.totalTaxableGain)}</span>
			</div>
			<div class="mt-2 flex items-center justify-between text-lg">
				<span class="flex items-center gap-2">
					Estimated Tax @
					<NativeSelect.Root class="w-40" bind:value={selectedTaxRate}>
						{#each taxRates as rate (rate.value)}
							<NativeSelect.Option value={rate.value}>{rate.value}%</NativeSelect.Option>
						{/each}
					</NativeSelect.Root>
				</span>
				<span class="font-bold">{formatCurrency(estimatedTax)}</span>
			</div>
		</div>
	</div>
</div>

<!-- Sale Simulator -->
<div class="mb-8">
	<h2 class="mb-3 text-base font-semibold">Sale Simulator</h2>
	<p class="mb-4 text-muted-foreground">
		Estimate the tax impact of selling units using FIFO (First In, First Out) method.
	</p>

	{#if taxSummary.holdings.length > 0}
		<div class="card mb-4">
			<Table.Root>
				<Table.Header>
					<Table.Row>
						<Table.Head>Holding</Table.Head>
						<Table.Head class="text-right">Price</Table.Head>
						<Table.Head class="text-right">Available</Table.Head>
						<Table.Head class="text-right">Units to Sell</Table.Head>
						<Table.Head class="text-right">Proceeds</Table.Head>
						<Table.Head class="text-right">Gain/Loss</Table.Head>
						<Table.Head class="text-right">Est. Tax</Table.Head>
						<Table.Head></Table.Head>
					</Table.Row>
				</Table.Header>
				<Table.Body>
					{#each taxSummary.holdings as holding (holding.id)}
						{@const unitsToSell = unitsToSellByHolding[holding.id] || 0}
						{@const mockResult = calculateMockSale(holding.id, unitsToSell)}
						<Table.Row>
							<Table.Cell>
								<p class="font-medium">{holding.name}</p>
								<p class="text-sm text-muted-foreground">{holding.code}</p>
							</Table.Cell>
							<Table.Cell class="text-right">{formatCurrency(holding.currentPrice)}</Table.Cell>
							<Table.Cell class="text-right">{holding.units}</Table.Cell>
							<Table.Cell class="text-right">
								<Input
									type="number"
									value={unitsToSell}
									oninput={(e) => {
										const value = parseInt(e.currentTarget.value) || 0;
										unitsToSellByHolding = {
											...unitsToSellByHolding,
											[holding.id]: Math.min(value, holding.units)
										};
									}}
									min="0"
									max={holding.units}
									placeholder="0"
									class="w-24 text-right"
								/>
							</Table.Cell>
							<Table.Cell class="text-right">
								{mockResult ? formatCurrency(mockResult.totalProceeds) : '-'}
							</Table.Cell>
							<Table.Cell class="text-right">
								{#if mockResult}
									<span class={mockResult.totalGain >= 0 ? '' : 'text-loss'}>
										{formatCurrency(mockResult.totalGain)}
									</span>
								{:else}
									-
								{/if}
							</Table.Cell>
							<Table.Cell class="text-right">
								{#if mockResult}
									<span class="">{formatCurrency(mockResult.estimatedTax)}</span>
								{:else}
									-
								{/if}
							</Table.Cell>
							<Table.Cell class="text-right">
								<div class="flex justify-end gap-1">
									<Button
										variant="outline"
										size="sm"
										onclick={() =>
											(unitsToSellByHolding = {
												...unitsToSellByHolding,
												[holding.id]: holding.units
											})}
									>
										All
									</Button>
									<Button
										variant="ghost"
										size="sm"
										onclick={() =>
											(unitsToSellByHolding = { ...unitsToSellByHolding, [holding.id]: 0 })}
									>
										Clear
									</Button>
								</div>
							</Table.Cell>
						</Table.Row>
					{/each}
				</Table.Body>
			</Table.Root>
		</div>

		{#if combinedMockSale}
			<div class="card border-2 border-primary">
				<h3 class="mb-4 text-lg font-semibold">Combined Sale Summary</h3>
				<div class="grid gap-4 md:grid-cols-4">
					<div>
						<p class="text-sm text-muted-foreground">Total Proceeds</p>
						<p class="text-base font-semibold">{formatCurrency(combinedMockSale.totalProceeds)}</p>
						<p class="text-xs text-muted-foreground">{combinedMockSale.totalUnits} units</p>
					</div>
					<div>
						<p class="text-sm text-muted-foreground">Cost Base</p>
						<p class="text-base font-semibold">{formatCurrency(combinedMockSale.totalCostBase)}</p>
					</div>
					<div>
						<p class="text-sm text-muted-foreground">Total Gain</p>
						<p
							class="text-xl font-semibold tabular-nums {combinedMockSale.totalGain >= 0
								? ''
								: 'text-loss'}"
						>
							{formatCurrency(combinedMockSale.totalGain)}
						</p>
						<p class="text-xs text-muted-foreground">
							Short: {formatCurrency(combinedMockSale.shortTermGain)} | Long: {formatCurrency(
								combinedMockSale.longTermGain
							)}
						</p>
					</div>
					<div>
						<p class="text-sm text-muted-foreground">Estimated Tax</p>
						<p class="text-xl font-semibold tabular-nums">
							{formatCurrency(combinedMockSale.estimatedTax)}
						</p>
						<p class="text-xs text-muted-foreground">
							Taxable: {formatCurrency(combinedMockSale.totalTaxableGain)} at {selectedTaxRate}%
						</p>
					</div>
				</div>

				{#if combinedMockSale.longTermGain > 0}
					<div class="mt-4 rounded-md border border-gain/30 bg-gain/10 p-3">
						<p class="text-sm text-gain dark:text-gain">
							<strong>CGT Discount Applied:</strong> Long-term gains of {formatCurrency(
								combinedMockSale.longTermGain
							)}
							reduced to {formatCurrency(combinedMockSale.taxableLongTerm)} (50% discount).
						</p>
					</div>
				{/if}
			</div>
		{/if}
	{:else}
		<div class="card py-8 text-center text-muted-foreground">No holdings to simulate sales.</div>
	{/if}
</div>
