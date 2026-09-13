<script lang="ts">
	import { resolve } from '$app/paths';
	import AddPortfolioDialog from '#lib/components/portfolio/add-portfolio-dialog.svelte';
	import EditPortfolioDialog from '#lib/components/portfolio/edit-portfolio-dialog.svelte';
	import DeleteDialog from '#lib/components/delete-dialog.svelte';
	import RowActionsMenu from '#lib/components/row-actions-menu.svelte';
	import { getPortfolios, deletePortfolio } from '#lib/remotes/portfolio.remote.js';
	import { ChevronRight } from '@lucide/svelte';

	const portfolios = $derived(await getPortfolios());

	type Portfolio = (typeof portfolios)[number];

	type Dialog =
		{ kind: 'edit'; portfolio: Portfolio } | { kind: 'delete'; portfolio: Portfolio } | null;

	let dialog = $state<Dialog>(null);
</script>

<div class="container mx-auto max-w-3xl py-4">
	<div class="mb-6 flex items-center justify-between pt-6">
		<h1 class="heading-primary">Portfolios</h1>
		<AddPortfolioDialog />
	</div>

	{#each portfolios as portfolio (portfolio.id)}
		<div
			class="card relative mb-3 flex items-center justify-between transition-all hover:border-primary hover:shadow-sm"
		>
			<a
				href={resolve('/(dashboard)/portfolios/[portfolioId]', { portfolioId: portfolio.id })}
				class="flex flex-1 items-center justify-between focus:outline-none"
			>
				<span class="absolute inset-0" aria-hidden="true"></span>
				<div>
					<div class="text-lg font-medium">{portfolio.name}</div>
					<p class="text-sm text-muted-foreground">
						{portfolio.holdings ? portfolio.holdings.length : 0} holdings
					</p>
				</div>
				<ChevronRight class="size-5 text-muted-foreground" />
			</a>
			<div class="relative z-10 ml-2">
				<RowActionsMenu
					label={portfolio.name}
					onEdit={() => (dialog = { kind: 'edit', portfolio })}
					onDelete={() => (dialog = { kind: 'delete', portfolio })}
				/>
			</div>
		</div>
	{/each}

	{#if portfolios.length === 0}
		<div class="card text-center">
			<p class="text-center text-muted-foreground">
				No portfolios found. Add a portfolio to get started.
			</p>
		</div>
	{/if}
</div>

{#if dialog?.kind === 'edit'}
	<EditPortfolioDialog
		open
		onOpenChange={(o) => !o && (dialog = null)}
		portfolioId={dialog.portfolio.id}
		portfolioName={dialog.portfolio.name}
	/>
{/if}

<DeleteDialog
	open={dialog?.kind === 'delete'}
	onOpenChange={(o) => !o && (dialog = null)}
	showTrigger={false}
	label={dialog?.kind === 'delete' ? dialog.portfolio.name : 'portfolio'}
	onDelete={async () => {
		if (dialog?.kind === 'delete') {
			await deletePortfolio({ id: dialog.portfolio.id });
			dialog = null;
		}
	}}
/>
