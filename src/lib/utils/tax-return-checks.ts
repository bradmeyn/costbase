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
}

export interface CompletenessInput {
	financialYearLabel: string;
	holdings: HoldingCompleteness[];
	/** Whether last year's carried-forward loss figure has been recorded at all. */
	priorYearLossRecorded: boolean;
	/** From buildTaxReturn: a fund's parts not adding up to its own total. */
	capitalGainsMismatch: number | null;
}

export interface Problem {
	/** A problem makes a label wrong; a note makes it unverified. */
	severity: 'problem' | 'note';
	message: string;
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
				message: `${holding.code} has no tax statement for ${year}. If the fund paid a distribution, the return is incomplete.`
			});
			continue;
		}

		if (holding.distributionCount === 0) {
			problems.push({
				severity: 'note',
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

	if (input.capitalGainsMismatch !== null) {
		problems.push({
			severity: 'problem',
			message: `A fund's capital gain components do not add up to the total it reported — a difference of ${money(Math.abs(input.capitalGainsMismatch))}. Check the capital gains section of that statement.`
		});
	}

	if (!input.priorYearLossRecorded) {
		problems.push({
			severity: 'note',
			message: `No capital losses carried forward have been recorded for ${year}. If last year's return carried any, 18A is overstated until they are entered.`
		});
	}

	return problems;
}
