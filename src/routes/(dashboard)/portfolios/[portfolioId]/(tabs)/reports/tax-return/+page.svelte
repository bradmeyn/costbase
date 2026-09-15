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
	import { getPortfolioAnnualStatements } from '#lib/remotes/annual.remote.js';
	import { getCarriedForwardLoss, setCarriedForwardLoss } from '#lib/remotes/tax-return.remote.js';
	import { formatCurrency, downloadCSV } from '#lib/utils.js';
	import { buildTaxReturn, type StatementAmounts } from '#lib/utils/tax-return.js';
	import { checkTaxReturn, type Problem } from '#lib/utils/tax-return-checks.js';
	import {
		distributionFinancialYear,
		financialYearLabel,
		readFinancialYear
	} from '#lib/report-period.js';
	import { financialYearEnd } from '$utils/amit-calculations';

	const portfolioId = $derived(page.params.portfolioId!);
	const financialYears = $derived(await getPortfolioFinancialYears(portfolioId));
	const reportFy = $derived(readFinancialYear(page.url, financialYears));
	const fyLabel = $derived(financialYearLabel(reportFy));

	const [portfolio, taxSummary, allStatements, allAnnual, allDistributions, carried] = $derived(
		await Promise.all([
			getPortfolio(portfolioId),
			getPortfolioTaxSummary({ id: portfolioId, financialYear: reportFy }),
			getPortfolioAmitStatements(portfolioId),
			getPortfolioAnnualStatements(portfolioId),
			getPortfolioDistributions({ id: portfolioId }),
			getCarriedForwardLoss({ portfolioId, financialYear: reportFy })
		])
	);

	const statements = $derived(allStatements.filter((s) => s.financialYear === reportFy));
	const annualStatements = $derived(allAnnual.filter((s) => s.financialYear === reportFy));

	/*
	  The two statements a year carries are on different bases and the reconciliation
	  only works if each is met on its own. The AMMA attributes a year's distributions,
	  which for the June quarter is paid the following July; the registry's annual
	  statement is a cash record, so it counts what actually landed between 1 July and
	  30 June and ignores anything reinvested.
	*/
	const attributedInYear = $derived(
		allDistributions.filter((d) => distributionFinancialYear(d) === reportFy)
	);
	const paidInYear = $derived(
		allDistributions.filter((d) => !d.reinvested && fyOf(d.datePaid) === reportFy)
	);

	/** Units on hand at a date, from the trades themselves. */
	const unitsHeldAt = (
		transactions: { transactionDate: Date | string; type: string; quantity: number }[],
		at: Date
	) =>
		transactions
			.filter((t) => new Date(t.transactionDate) <= at)
			.reduce((units, t) => units + (t.type === 'sell' ? -t.quantity : t.quantity), 0);

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
				const attributed = attributedInYear.filter((d) => d.code === h.investment.code);
				const cash = paidInYear.filter((d) => d.code === h.investment.code);
				const annual = annualStatements.filter((s) => s.holdingId === h.id);
				/*
				  Only the statement that closes the year says what was held at 30 June.
				  A mid-year broker change leaves an earlier one showing nothing left,
				  which is true of that HIN and not of the holding.
				*/
				const closing = annual.reduce<(typeof annual)[number] | null>(
					(latest, s) =>
						!latest || new Date(s.periodEnd) > new Date(latest.periodEnd) ? s : latest,
					null
				);
				return {
					code: h.investment.code,
					hasStatement: forHolding.length > 0,
					distributionsTotal: attributed.reduce((s, d) => s + d.grossPayment, 0),
					distributionCount: attributed.length,
					statementGrossCash:
						forHolding.length > 0
							? forHolding.reduce((total, s) => total + s.grossCashDistribution, 0)
							: null,
					annualStatementCount: annual.length,
					statementClosingUnits: closing ? closing.closingUnits : null,
					unitsAtYearEnd: unitsHeldAt(h.transactions, financialYearEnd(reportFy)),
					statementCashPaid:
						annual.length > 0
							? annual.reduce((total, s) => total + s.cashDistributionReceived, 0)
							: null,
					cashPaidTotal: cash.reduce((s, d) => s + d.grossPayment, 0)
				};
			}),
			priorYearLossRecorded: carried.recorded,
			capitalGainsMismatch: taxReturn.capitalGainsMismatch
		})
	);

	const blocking = $derived(problems.filter((p) => p.severity === 'problem'));
	/** Notes are read where they apply, so each section asks for its own. */
	const notesOn = (topic: Problem['topic']) =>
		problems.filter((p) => p.severity === 'note' && p.topic === topic);

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

	type Label = {
		code: string;
		title: string;
		amount: number;
		note?: string;
		/*
		  What this label contributes for one holding, where that can be said at all.
		  Null means the figure only exists for the portfolio as a whole — the 18A
		  working nets gains and losses across everything you own, so splitting it by
		  fund would invent a number myTax never asks for.
		*/
		cell?: (code: string) => number | null;
	};

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

	/*
	  18H is the one capital gains figure that belongs to a single fund: your disposals
	  of it, plus what it attributed, grossed up the same way the total is.
	*/
	const gainsFor = (code: string) => {
		const own = yearGains
			.filter((g) => g.holdingCode === code && g.gain > 0)
			.reduce((s, g) => s + g.gain, 0);
		const excess = taxSummary.amitExcessGains
			.filter((e) => e.code === code)
			.reduce((s, e) => s + e.amount, 0);
		const entry = perHolding.find((h) => h.code === code);
		const attributed = (entry?.statements ?? []).reduce(
			(s, st) =>
				s + st.otherMethodTap + st.otherMethodNtap + (st.discountedTap + st.discountedNtap) * 2,
			0
		);
		return own + excess + attributed;
	};

	const section18 = $derived<Label[]>([
		{
			code: '18H',
			title: 'Total current year capital gains',
			amount: taxReturn.label18H,
			note: 'Your disposals plus the capital gains each fund attributed, grossed up.',
			cell: gainsFor
		},
		{
			code: '18A',
			title: 'Net capital gain',
			amount: taxReturn.label18A,
			note: 'After losses and the 50% discount. This is the amount added to your income.',
			cell: () => null
		},
		{
			code: '18V',
			title: 'Net capital losses carried forward to later income years',
			amount: taxReturn.label18V,
			cell: () => null
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
			const cells = perHolding.map((entry) => {
				const cents = label.cell ? label.cell(entry.code) : amountFor(entry, label.code);
				// A label with no per-fund meaning leaves the cell empty rather than zero.
				return cents === null ? '' : (cents / 100).toFixed(2);
			});
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
							{@const cents = row.cell ? row.cell(entry.code) : amountFor(entry, row.code)}
							<Table.Cell class="text-right text-muted-foreground tabular-nums">
								{cents === null ? '—' : formatCurrency(cents)}
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

<!-- Notes for one section, shown under the table they qualify. -->
{#snippet sectionNotes(topic: Problem['topic'])}
	{@const found = notesOn(topic)}
	{#if found.length > 0}
		<ul class="mt-2 space-y-1">
			{#each found as note, i (i)}
				<li class="flex gap-1.5 text-[11px] text-muted-foreground">
					<Info class="mt-px size-3.5 shrink-0" />
					{note.message}
				</li>
			{/each}
		</ul>
	{/if}
{/snippet}

{#if blocking.length > 0}
	<div class="mb-5 rounded-md border border-brand-2/40 bg-brand-2/10 p-4">
		<p class="flex items-center gap-2 text-sm font-medium text-brand-2">
			<TriangleAlert class="size-4" />
			{blocking.length === 1
				? 'One thing to fix before you file'
				: `${blocking.length} things to fix before you file`}
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
		<h2 class="text-base font-semibold">Partnerships and trusts</h2>
		<span class="text-[11px] text-muted-foreground">
			Entered against each trust in turn — the columns are what myTax asks for per fund
		</span>
	</div>
	<div class="card">{@render labelTable(section13, perHolding.length > 1)}</div>
	{@render sectionNotes('trusts')}
</section>

<section class="mb-6">
	<div class="mb-2 flex items-baseline gap-2">
		<h2 class="text-base font-semibold">Capital gains</h2>
		<span class="text-[11px] text-muted-foreground">
			18G · Did you have a capital gains tax event? <strong class="text-foreground">
				{taxReturn.label18G ? 'Yes' : 'No'}
			</strong>
		</span>
	</div>
	<div class="card">{@render labelTable(section18, perHolding.length > 1)}</div>
	{@render sectionNotes('capital-gains')}

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
		{@render sectionNotes('carried-forward-losses')}
	</div>
</section>

<section class="mb-6">
	<div class="mb-2 flex items-baseline gap-2">
		<h2 class="text-base font-semibold">Foreign source income</h2>
		<span class="text-[11px] text-muted-foreground">From each fund's annual tax statement</span>
	</div>
	<div class="card">{@render labelTable(section20, perHolding.length > 1)}</div>
</section>

<p class="text-[11px] text-muted-foreground">
	This portfolio only. It knows nothing about employment income, other investments, or anything held
	outside {portfolio.name}. Check it against the statements before you file.
</p>
