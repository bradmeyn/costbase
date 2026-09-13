<script lang="ts">
	import { resolve } from '$app/paths';
	import { getPortfolio, deletePortfolio } from '#lib/remotes/portfolio.remote.js';
	import { deleteHolding } from '#lib/remotes/holding.remote.js';
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import * as Table from '$ui/table';
	import Button from '$ui/button/button.svelte';
	import AddHoldingDialog from '#lib/components/holding/add-holding-dialog.svelte';
	import EditHoldingDialog from '#lib/components/holding/edit-holding-dialog.svelte';
	import EditPortfolioDialog from '#lib/components/portfolio/edit-portfolio-dialog.svelte';
	import DeleteDialog from '#lib/components/delete-dialog.svelte';
	import RowActionsMenu from '#lib/components/row-actions-menu.svelte';
	import SummaryCard from '#lib/components/summary-card.svelte';
	import * as DropdownMenu from '#lib/components/ui/dropdown-menu/index.js';
	import { EllipsisVertical, Pencil, Plus, Trash2 } from '@lucide/svelte';
	import { formatCurrency } from '#lib/utils.js';

	const portfolio = $derived(await getPortfolio(page.params.portfolioId!));
	const portfolioId = page.params.portfolioId!;

	type Holding = (typeof portfolio.holdings)[number];

	let addHoldingOpen = $state(false);

	type Dialog =
		| { kind: 'edit-holding'; holding: Holding }
		| { kind: 'delete-holding'; holding: Holding }
		| { kind: 'edit-portfolio' }
		| { kind: 'delete-portfolio' }
		| null;

	let dialog = $state<Dialog>(null);
</script>

<div class="mb-4 flex items-center justify-between">
	<div></div>
	<DropdownMenu.Root>
		<DropdownMenu.Trigger
			class="inline-flex size-9 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors outline-none hover:bg-accent hover:text-accent-foreground"
			aria-label="Portfolio actions for {portfolio.name}"
		>
			<EllipsisVertical class="size-4" />
		</DropdownMenu.Trigger>
		<DropdownMenu.Content align="end">
			<DropdownMenu.Group>
				<DropdownMenu.Item onSelect={() => (addHoldingOpen = true)}>
					<Plus class="size-4" />
					<span>Add holding</span>
				</DropdownMenu.Item>
				<DropdownMenu.Item onSelect={() => (dialog = { kind: 'edit-portfolio' })}>
					<Pencil class="size-4" />
					<span>Edit portfolio</span>
				</DropdownMenu.Item>
				<DropdownMenu.Separator />
				<DropdownMenu.Item
					onSelect={() => (dialog = { kind: 'delete-portfolio' })}
					class="text-destructive data-highlighted:text-destructive"
				>
					<Trash2 class="size-4 text-destructive" />
					<span>Delete portfolio</span>
				</DropdownMenu.Item>
			</DropdownMenu.Group>
		</DropdownMenu.Content>
	</DropdownMenu.Root>
</div>

<AddHoldingDialog {portfolioId} bind:open={addHoldingOpen} showTrigger={false} />

{#if portfolio.holdings.length > 0}
	<!-- Portfolio Summary -->
	<div class="mb-5 grid gap-2 md:grid-cols-3">
		<SummaryCard label="Current value" value={formatCurrency(portfolio.totalValue)} />
		<SummaryCard
			label="Unrealised gain"
			value={`${portfolio.totalUnrealisedGain >= 0 ? '+' : ''}${formatCurrency(portfolio.totalUnrealisedGain)}`}
			valueClass={portfolio.totalUnrealisedGain >= 0 ? 'text-gain' : 'text-loss'}
		/>
		<SummaryCard
			label="Return"
			value={`${portfolio.totalUnrealisedGainPercent >= 0 ? '+' : ''}${portfolio.totalUnrealisedGainPercent.toFixed(2)}%`}
			valueClass={portfolio.totalUnrealisedGainPercent >= 0 ? 'text-gain' : 'text-loss'}
		/>
	</div>
	<div class="card">
		<Table.Root>
			<Table.Header>
				<Table.Row>
					<Table.Head>Name</Table.Head>
					<Table.Head>Code</Table.Head>
					<Table.Head class="text-right">Units</Table.Head>
					<Table.Head class="text-right">Avg Price</Table.Head>
					<Table.Head class="text-right">Current Price</Table.Head>
					<Table.Head class="text-right">Value</Table.Head>
					<Table.Head class="text-right">Gain/Loss</Table.Head>
					<Table.Head class="text-right">Actions</Table.Head>
				</Table.Row>
			</Table.Header>
			<Table.Body>
				{#each portfolio.holdings as holding (holding.id)}
					<Table.Row>
						<Table.Cell class="font-medium">{holding.name}</Table.Cell>
						<Table.Cell>{holding.code}</Table.Cell>
						<Table.Cell class="text-right">{holding.units}</Table.Cell>
						<Table.Cell class="text-right">{formatCurrency(holding.averagePrice)}</Table.Cell>
						<Table.Cell class="text-right">{formatCurrency(holding.currentPrice)}</Table.Cell>
						<Table.Cell class="text-right">{formatCurrency(holding.currentValue)}</Table.Cell>
						<Table.Cell
							class="text-right {holding.unrealisedGain >= 0 ? 'text-gain' : 'text-loss'}"
						>
							{holding.unrealisedGain >= 0 ? '+' : ''}{formatCurrency(holding.unrealisedGain)}
							<span class="text-xs">({holding.unrealisedGainPercent.toFixed(1)}%)</span>
						</Table.Cell>
						<Table.Cell class="text-right">
							<div class="flex items-center justify-end gap-1">
								<Button
									href={resolve('/(dashboard)/portfolios/[portfolioId]/[holdingId]/(tabs)', {
										portfolioId,
										holdingId: holding.id
									})}
									variant="ghost"
									size="sm">View</Button
								>
								<RowActionsMenu
									label={holding.name}
									onEdit={() => (dialog = { kind: 'edit-holding', holding })}
									onDelete={() => (dialog = { kind: 'delete-holding', holding })}
								/>
							</div>
						</Table.Cell>
					</Table.Row>
				{/each}
			</Table.Body>
		</Table.Root>
	</div>
{:else}
	<div class="flex flex-col items-center justify-center py-12 text-center">
		<p class="mb-4 text-muted-foreground">
			No holdings yet. Add your first holding to get started.
		</p>
		<Button onclick={() => (addHoldingOpen = true)}>Add Holding</Button>
	</div>
{/if}

{#if dialog?.kind === 'edit-holding'}
	<EditHoldingDialog
		open
		onOpenChange={(o) => !o && (dialog = null)}
		holdingId={dialog.holding.id}
		{portfolioId}
		holding={{ investmentId: dialog.holding.investmentId }}
	/>
{/if}

{#if dialog?.kind === 'edit-portfolio'}
	<EditPortfolioDialog
		open
		onOpenChange={(o) => !o && (dialog = null)}
		{portfolioId}
		portfolioName={portfolio.name}
	/>
{/if}

<DeleteDialog
	open={dialog?.kind === 'delete-holding'}
	onOpenChange={(o) => !o && (dialog = null)}
	showTrigger={false}
	label={dialog?.kind === 'delete-holding' ? dialog.holding.name : 'holding'}
	onDelete={async () => {
		if (dialog?.kind === 'delete-holding') {
			await deleteHolding({ id: dialog.holding.id }).updates(getPortfolio(portfolioId));
			dialog = null;
		}
	}}
/>

<DeleteDialog
	open={dialog?.kind === 'delete-portfolio'}
	onOpenChange={(o) => !o && (dialog = null)}
	showTrigger={false}
	label={portfolio.name}
	onDelete={async () => {
		await deletePortfolio({ id: portfolioId });
		dialog = null;
		await goto(resolve('/(dashboard)/portfolios'));
	}}
/>
