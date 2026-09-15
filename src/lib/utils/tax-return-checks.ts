/*
  What the return would be missing, said plainly.

  A return assembled from incomplete data looks exactly like one assembled from
  complete data — every label still shows a number. These checks are the difference
  between a figure you can file and a figure you have to go and verify elsewhere.
*/

export interface HoldingCompleteness {
	code: string;
	/** Whether a tax statement (AMMA) has been entered for the year. */
	hasStatement: boolean;
	/** Cash actually recorded as distributions in the year, in cents. */
	distributionsTotal: number;
	distributionCount: number;
	/** The statement's own gross cash distribution, where one was entered. */
	statementGrossCash: number | null;
	/*
	  The registry's annual statement is the other half of the year: the AMMA says what
	  was attributed, the annual statement says what was actually held and paid. They
	  catch different mistakes — a missing trade moves units without moving a dollar of
	  attribution, so only the unit count finds it.
	*/
	annualStatementCount: number;
	/** Units the registry had at 30 June, from the statement closing that year. */
	statementClosingUnits: number | null;
	/** Units the app works out were held at 30 June. */
	unitsAtYearEnd: number;
	/** Cash the registry says it paid across the year, summed over its statements. */
	statementCashPaid: number | null;
	/** Distributions recorded as taken in cash, on the same payment-date basis. */
	cashPaidTotal: number;
}

export interface CompletenessInput {
	financialYearLabel: string;
	holdings: HoldingCompleteness[];
	/** Whether last year's carried-forward loss figure has been recorded at all. */
	priorYearLossRecorded: boolean;
	/** From buildTaxReturn: a fund's parts not adding up to its own total. */
	capitalGainsMismatch: number | null;
}

/*
  Where a note belongs on the page. A problem stops you filing, so it is stated
  once at the top; a note is only worth reading next to the thing it is about,
  which is usually the control that resolves it.
*/
export type Topic = 'trusts' | 'capital-gains' | 'carried-forward-losses';

export interface Problem {
	/** A problem makes a label wrong; a note makes it unverified. */
	severity: 'problem' | 'note';
	message: string;
	/** The section a note is shown under. Problems are not filed this way. */
	topic?: Topic;
}

const money = (cents: number) =>
	`$${(cents / 100).toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export function checkTaxReturn(input: CompletenessInput): Problem[] {
	const problems: Problem[] = [];
	const year = input.financialYearLabel;

	for (const holding of input.holdings) {
		if (!holding.hasStatement && holding.distributionCount > 0) {
			problems.push({
				severity: 'problem',
				message: `${holding.code} was paid ${money(holding.distributionsTotal)} in ${year} but has no tax statement. Its attribution and cost base adjustment are missing from this return.`
			});
			continue;
		}

		if (!holding.hasStatement) {
			problems.push({
				severity: 'note',
				topic: 'trusts',
				message: `${holding.code} has no tax statement for ${year}. If the fund paid a distribution, the return is incomplete.`
			});
			continue;
		}

		if (holding.distributionCount === 0) {
			problems.push({
				severity: 'note',
				topic: 'trusts',
				message: `${holding.code} has a tax statement for ${year} but no distributions recorded against it, so the cash side cannot be checked.`
			});
			continue;
		}

		// The statement's own cash figure is the one the registry paid.
		if (
			holding.statementGrossCash !== null &&
			holding.statementGrossCash !== holding.distributionsTotal
		) {
			const gap = holding.statementGrossCash - holding.distributionsTotal;
			problems.push({
				severity: 'problem',
				message: `${holding.code}: the statement says ${money(holding.statementGrossCash)} was distributed in ${year}, but ${money(holding.distributionsTotal)} is recorded — ${money(Math.abs(gap))} ${gap > 0 ? 'missing' : 'too much'}.`
			});
		}
	}

	for (const holding of input.holdings) {
		if (holding.annualStatementCount === 0) {
			problems.push({
				severity: 'note',
				topic: 'trusts',
				message: `${holding.code} has no annual statement for ${year}, so its unit count and the cash it paid cannot be checked against the registry.`
			});
			continue;
		}

		if (
			holding.statementClosingUnits !== null &&
			holding.statementClosingUnits !== holding.unitsAtYearEnd
		) {
			const gap = holding.unitsAtYearEnd - holding.statementClosingUnits;
			problems.push({
				severity: 'problem',
				message: `${holding.code}: the registry held ${holding.statementClosingUnits.toLocaleString('en-AU')} units at the end of ${year}, but this portfolio works out to ${holding.unitsAtYearEnd.toLocaleString('en-AU')} — ${Math.abs(gap).toLocaleString('en-AU')} ${gap > 0 ? 'too many' : 'missing'}. A trade or reinvestment is wrong.`
			});
		}

		/*
		  Annual statements round each amount to whole dollars, so a year covered by two
		  of them can differ by that much again before anything is actually wrong.
		*/
		if (holding.statementCashPaid !== null) {
			const gap = holding.statementCashPaid - holding.cashPaidTotal;
			if (Math.abs(gap) > 100 * holding.annualStatementCount) {
				problems.push({
					severity: 'problem',
					message: `${holding.code}: the registry paid ${money(holding.statementCashPaid)} in cash during ${year}, but ${money(holding.cashPaidTotal)} is recorded — ${money(Math.abs(gap))} ${gap > 0 ? 'missing' : 'too much'}.`
				});
			}
		}
	}

	if (input.capitalGainsMismatch !== null) {
		problems.push({
			severity: 'problem',
			message: `A fund's capital gain components do not add up to the total it reported — a difference of ${money(Math.abs(input.capitalGainsMismatch))}. Check the capital gains section of that statement.`
		});
	}

	if (!input.priorYearLossRecorded) {
		problems.push({
			severity: 'note',
			topic: 'carried-forward-losses',
			message: `If last year's return carried capital losses forward, 18A is overstated until they are entered here.`
		});
	}

	return problems;
}
