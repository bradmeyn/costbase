<script lang="ts">
	import { page } from '$app/state';
	import * as Table from '$ui/table';
	import Input from '$ui/input/input.svelte';
	import Button from '$ui/button/button.svelte';
	import SummaryCard from '#lib/components/summary-card.svelte';
	import { TriangleAlert, Info } from '@lucide/svelte';
	import { registerReport } from '#lib/report-chrome.svelte.js';
	import {
		getPortfolio,
		getPortfolioFinancialYears,
		getPortfolioTaxSummary,
		getPortfolioDistributions
	} from '#lib/remotes/portfolio.remote.js';
	import { getPortfolioAmitStatements } from '#lib/remotes/amit.remote.js';
	import { getCarriedForwardLoss, setCarriedForwardLoss } from '#lib/remotes/tax-return.remote.js';
	import { formatCurrency, downloadCSV } from '#lib/utils.js';
	import { buildTaxReturn, type StatementAmounts } from '#lib/utils/tax-return.js';
	import { checkTaxReturn } from '#lib/utils/tax-return-checks.js';
	import {
		financialYearLabel,
		financialYearWindow,
		readFinancialYear
	} from '#lib/report-period.js';

	const portfolioId = $derived(page.params.portfolioId!);
	const financialYears = $derived(await getPortfolioFinancialYears(portfolioId));
	const reportFy = $derived(readFinancialYear(page.url, financialYears));
	const fyLabel = $derived(financialYearLabel(reportFy));
	const fyWindow = $derived(financialYearWindow(reportFy));

	const [portfolio, taxSummary, allStatements, distributions, carried] = $derived(
		await Promise.all([
			getPortfolio(portfolioId),
			getPortfolioTaxSummary({ id: portfolioId, financialYear: reportFy }),
			getPortfolioAmitStatements(portfolioId),
			getPortfolioDistributions({ id: portfolioId, ...fyWindow }),
			getCarriedForwardLoss({ portfolioId, financialYear: reportFy })
		])
	);

	const statements = $derived(allStatements.filter((s) => s.financialYear === reportFy));

	/** FY (ending year) of a date: anything from 1 July belongs to the next year. */
	const fyOf = (d: Date | string) => {
		const date = new Date(d);
		return date.getMonth() >= 6 ? date.getFullYear() + 1 : date.getFullYear();
	};

	const yearGains = $derived(
		[...taxSummary.realisedGains.shortTerm, ...taxSummary.realisedGains.longTerm].filter(
			(g) => fyOf(g.saleDate) === reportFy
		)
	);
	const ownShortTermGains = $derived(
		yearGains.filter((g) => !g.isLongTerm && g.gain > 0).reduce((s, g) => s + g.gain, 0)
	);
	const ownLongTermGains = $derived(
		yearGains.filter((g) => g.isLongTerm && g.gain > 0).reduce((s, g) => s + g.gain, 0)
	);
	const ownCapitalLosses = $derived(
		Math.abs(yearGains.filter((g) => g.gain < 0).reduce((s, g) => s + g.gain, 0))
	);

	const taxReturn = $derived(
		buildTaxReturn({
			ownShortTermGains,
			ownLongTermGains,
			ownCapitalLosses,
			amitExcessGains: taxSummary.amitExcessGains.reduce((s, e) => s + e.amount, 0),
			statements: statements as unknown as StatementAmounts[],
			priorYearLosses: carried.amount
		})
	);

	const problems = $derived(
		checkTaxReturn({
			financialYearLabel: fyLabel,
			holdings: portfolio.holdings.map((h) => {
				// Summed: a year can carry one statement per holder number, and the cash
				// they report between them is what the registry actually paid.
				const forHolding = statements.filter((s) => s.holdingId === h.id);
				const paid = distributions.filter((d) => d.code === h.investment.code);
				return {
					code: h.investment.code,
					hasStatement: forHolding.length > 0,
					distributionsTotal: paid.reduce((s, d) => s + d.grossPayment, 0),
					distributionCount: paid.length,
					statementGrossCash:
						forHolding.length > 0
							? forHolding.reduce((total, s) => total + s.grossCashDistribution, 0)
							: null
				};
			}),
			priorYearLossRecorded: carried.recorded,
			capitalGainsMismatch: taxReturn.capitalGainsMismatch
		})
	);

	const blocking = $derived(problems.filter((p) => p.severity === 'problem'));
	const notes = $derived(problems.filter((p) => p.severity === 'note'));

	/* Losses carried in, edited in dollars and saved on demand. */
	let lossDraft = $state<string | null>(null);
	let savingLoss = $state(false);
	const lossValue = $derived(lossDraft ?? (carried.amount / 100).toFixed(2));

	async function saveLoss() {
		savingLoss = true;
		try {
			await setCarriedForwardLoss({
				portfolioId,
				financialYear: reportFy,
				amount: Math.round((parseFloat(lossValue) || 0) * 100)
			});
			lossDraft = null;
		} finally {
			savingLoss = false;
		}
	}

	type Label = { code: string; title: string; amount: number; note?: string };

	/*
	  Items 13 and 20 are entered against each trust in turn — myTax asks for a record
	  per fund — so they are shown per holding with the total alongside. Item 18 is the
	  one aggregate: capital gains are netted across everything you own, not per trust.
	*/
	const perHolding = $derived(
		portfolio.holdings
			.map((holding) => ({
				code: holding.investment.code,
				// A holding can have two statements for one year, one per holder number.
				// Both are the same trust, so the column adds them.
				statements: statements.filter((s) => s.holdingId === holding.id)
			}))
			.filter((entry) => entry.statements.length > 0)
			.sort((a, b) => a.code.localeCompare(b.code))
	);

	const amountFor = (group: (typeof perHolding)[number], code: string) =>
		group.statements.reduce((total, statement) => {
			const field = `label${code}` as keyof typeof statement;
			return total + Number(statement[field] ?? 0);
		}, 0);

	const section13 = $derived<Label[]>([
		{
			code: '13U',
			title:
				'Share of net income from trusts, less net capital gains, foreign income and franked distributions',
			amount: taxReturn.label13U
		},
		{ code: '13C', title: 'Franked distributions from trusts', amount: taxReturn.label13C },
		{
			code: '13Q',
			title: 'Share of credit for franking credits from franked dividends',
			amount: taxReturn.label13Q
		},
		{ code: '13R', title: 'Share of credit for TFN amounts withheld', amount: taxReturn.label13R },
		{
			code: '13A',
			title: 'Share of credit for foreign resident withholding amounts',
			amount: taxReturn.label13A
		}
	]);

	const section18 = $derived<Label[]>([
		{
			code: '18H',
			title: 'Total current year capital gains',
			amount: taxReturn.label18H,
			note: 'Your disposals plus the capital gains each fund attributed, grossed up.'
		},
		{
			code: '18A',
			title: 'Net capital gain',
			amount: taxReturn.label18A,
			note: 'After losses and the 50% discount. This is the amount added to your income.'
		},
		{
			code: '18V',
			title: 'Net capital losses carried forward to later income years',
			amount: taxReturn.label18V
		}
	]);

	const section20 = $derived<Label[]>([
		{ code: '20E', title: 'Assessable foreign source income', amount: taxReturn.label20E },
		{ code: '20M', title: 'Other net foreign source income', amount: taxReturn.label20M },
		{ code: '20O', title: 'Foreign income tax offset', amount: taxReturn.label20O }
	]);

	function generateCsv() {
		const columns = perHolding.map((entry) => entry.code);
		let csv = `Tax return ${fyLabel}\n\nLabel,Item,${columns.join(',')},Total\n`;
		for (const label of [...section13, ...section18, ...section20]) {
			// Item 18 is a single netted figure, so its per-holding cells stay blank.
			const cells = section18.includes(label)
				? columns.map(() => '')
				: perHolding.map((entry) => (amountFor(entry, label.code) / 100).toFixed(2));
			csv += `${label.code},"${label.title}",${cells.join(',')},${(label.amount / 100).toFixed(2)}\n`;
		}
		csv += `18G,"Did you have a capital gains tax event?",${taxReturn.label18G ? 'Yes' : 'No'}\n`;
		downloadCSV(csv, `tax-return-${fyLabel}`);
	}

	registerReport(() => ({
		title: 'Tax return',
		subtitle: `${fyLabel} · every label this portfolio contributes, in the order myTax asks for them`,
		csv: generateCsv
	}));
</script>

<!-- One line of the 18A working. -->
{#snippet working(label: string, amount: number, hint?: string)}
	<Table.Row>
		<Table.Cell>
			{label}
			{#if hint}
				<span class="ml-1.5 text-[11px] text-muted-foreground">{hint}</span>
			{/if}
		</Table.Cell>
		<Table.Cell class="text-right tabular-nums">{formatCurrency(amount)}</Table.Cell>
	</Table.Row>
{/snippet}

{#snippet labelTable(rows: Label[], byHolding = false)}
	<Table.Root>
		<Table.Header>
			<Table.Row>
				<Table.Head class="w-16">Label</Table.Head>
				<Table.Head>Item</Table.Head>
				{#if byHolding}
					{#each perHolding as entry (entry.code)}
						<Table.Head class="w-32 text-right">{entry.code}</Table.Head>
					{/each}
				{/if}
				<Table.Head class="w-40 text-right">{byHolding ? 'Total' : 'Amount'}</Table.Head>
			</Table.Row>
		</Table.Header>
		<Table.Body>
			{#each rows as row (row.code)}
				<Table.Row>
					<Table.Cell class="font-medium text-primary">{row.code}</Table.Cell>
					<Table.Cell>
						{row.title}
						{#if row.note}
							<p class="mt-0.5 text-[11px] text-muted-foreground">{row.note}</p>
						{/if}
					</Table.Cell>
					{#if byHolding}
						{#each perHolding as entry (entry.code)}
							<Table.Cell class="text-right text-muted-foreground tabular-nums">
								{formatCurrency(amountFor(entry, row.code))}
							</Table.Cell>
						{/each}
					{/if}
					<Table.Cell class="text-right font-semibold tabular-nums">
						{formatCurrency(row.amount)}
					</Table.Cell>
				</Table.Row>
			{/each}
		</Table.Body>
	</Table.Root>
{/snippet}

{#if blocking.length > 0 || notes.length > 0}
	<div class="mb-5 space-y-2">
		{#if blocking.length > 0}
			<div class="rounded-md border border-brand-2/40 bg-brand-2/10 p-4">
				<p class="flex items-center gap-2 text-sm font-medium text-brand-2">
					<TriangleAlert class="size-4" />
					{blocking.length === 1
						? 'One figure is missing'
						: `${blocking.length} figures are missing`}
				</p>
				<ul class="mt-2 space-y-1">
					{#each blocking as problem, i (i)}
						<li class="text-[13px] text-muted-foreground">{problem.message}</li>
					{/each}
				</ul>
				<p class="mt-2 text-[11px] text-muted-foreground">
					The labels below are still shown, but they are incomplete until these are resolved.
				</p>
			</div>
		{/if}

		{#if notes.length > 0}
			<div class="rounded-md border border-border bg-card p-4">
				<p class="flex items-center gap-2 text-sm font-medium">
					<Info class="size-4 text-muted-foreground" /> Worth checking
				</p>
				<ul class="mt-2 space-y-1">
					{#each notes as problem, i (i)}
						<li class="text-[13px] text-muted-foreground">{problem.message}</li>
					{/each}
				</ul>
			</div>
		{/if}
	</div>
{/if}

<div class="mb-5 grid gap-4 md:grid-cols-3">
	<SummaryCard label="Net capital gain (18A)" value={formatCurrency(taxReturn.label18A)}>
		<p class="mt-1 text-xs text-muted-foreground">Added to your assessable income</p>
	</SummaryCard>
	<SummaryCard
		label="Trust income (13U + 13C)"
		value={formatCurrency(taxReturn.label13U + taxReturn.label13C)}
	>
		<p class="mt-1 text-xs text-muted-foreground">Attributed by the funds</p>
	</SummaryCard>
	<SummaryCard
		label="Credits (13Q + 20O)"
		value={formatCurrency(taxReturn.label13Q + taxReturn.label20O)}
	>
		<p class="mt-1 text-xs text-muted-foreground">Franking and foreign tax offsets</p>
	</SummaryCard>
</div>

<section class="mb-6">
	<div class="mb-2 flex items-baseline gap-2">
		<h2 class="text-base font-semibold">13 — Partnerships and trusts</h2>
		<span class="text-[11px] text-muted-foreground">
			Entered against each trust in turn — the columns are what myTax asks for per fund
		</span>
	</div>
	<div class="card">{@render labelTable(section13, perHolding.length > 1)}</div>
</section>

<section class="mb-6">
	<div class="mb-2 flex items-baseline gap-2">
		<h2 class="text-base font-semibold">18 — Capital gains</h2>
		<span class="text-[11px] text-muted-foreground">
			18G · Did you have a capital gains tax event? <strong class="text-foreground">
				{taxReturn.label18G ? 'Yes' : 'No'}
			</strong>
		</span>
	</div>
	<div class="card">{@render labelTable(section18)}</div>

	<div class="card mt-3">
		<h3 class="mb-3 text-sm font-semibold">How 18A was worked out</h3>
		<Table.Root>
			<Table.Body>
				{@render working('Your disposals — held 12 months or less', ownShortTermGains)}
				{@render working('Your disposals — held over 12 months', ownLongTermGains)}
				{@render working(
					'Attributed by the funds — other method',
					taxReturn.trustOtherMethodGains,
					'no discount applies'
				)}
				{@render working(
					'Attributed by the funds — discounted, grossed up',
					taxReturn.trustDiscountedGrossedUp,
					'doubled, so your own losses apply to the whole gain'
				)}
				{@render working('Your capital losses this year', -ownCapitalLosses)}
				{@render working('Losses carried in from earlier years', -taxReturn.cgt.priorYearLosses)}
				{@render working(
					'Less losses applied',
					-(taxReturn.cgt.lossesAppliedToShortTerm + taxReturn.cgt.lossesAppliedToLongTerm)
				)}
				{@render working('Less 50% CGT discount', -taxReturn.cgt.cgtDiscount)}
			</Table.Body>
			<Table.Footer>
				<Table.Row>
					<Table.Cell class="font-medium">Net capital gain (18A)</Table.Cell>
					<Table.Cell class="text-right font-semibold tabular-nums">
						{formatCurrency(taxReturn.label18A)}
					</Table.Cell>
				</Table.Row>
			</Table.Footer>
		</Table.Root>
	</div>

	<div class="card mt-3 print:hidden">
		<h3 class="text-sm font-semibold">Capital losses carried forward into {fyLabel}</h3>
		<p class="mt-1 text-[13px] text-muted-foreground">
			From label 18V on last year's return. Nothing here can work this out for you — the losses may
			predate anything this portfolio holds.
		</p>
		<div class="mt-3 flex items-center gap-2">
			<Input
				type="number"
				step="0.01"
				min="0"
				value={lossValue}
				oninput={(e) => (lossDraft = e.currentTarget.value)}
				class="w-40 tabular-nums"
				aria-label="Capital losses carried forward"
			/>
			<Button onclick={saveLoss} disabled={savingLoss || lossDraft === null}>
				{savingLoss ? 'Saving…' : 'Save'}
			</Button>
			{#if carried.recorded && lossDraft === null}
				<span class="text-[13px] text-muted-foreground">Recorded</span>
			{/if}
		</div>
	</div>
</section>

<section class="mb-6">
	<div class="mb-2 flex items-baseline gap-2">
		<h2 class="text-base font-semibold">20 — Foreign source income</h2>
		<span class="text-[11px] text-muted-foreground">From each fund's annual tax statement</span>
	</div>
	<div class="card">{@render labelTable(section20, perHolding.length > 1)}</div>
</section>

<p class="text-[11px] text-muted-foreground">
	This portfolio only. It knows nothing about employment income, other investments, or anything held
	outside {portfolio.name}. Check it against the statements before you file.
</p>
