<script lang="ts">
	import {
		getAssets,
		getLiabilities,
		deleteAsset,
		deleteLiability
	} from '#lib/remotes/balance-sheet.remote.js';
	import { getNetWorth } from '#lib/remotes/portfolio.remote.js';
	import DeleteDialog from '#lib/components/delete-dialog.svelte';
	import AddAssetDialog from './_components/add-asset-dialog.svelte';
	import EditAssetDialog from './_components/edit-asset-dialog.svelte';
	import AddLiabilityDialog from './_components/add-liability-dialog.svelte';
	import EditLiabilityDialog from './_components/edit-liability-dialog.svelte';
	import type { Asset, Liability } from '$db/schemas/budget';
	import BalanceSheetSummary from './_components/balance-sheet-summary.svelte';
	import BalanceSheetSection from './_components/balance-sheet-section.svelte';
	import BalanceSheetRow from './_components/balance-sheet-row.svelte';
	import { formatPercentage } from '$utils/formatters';

	const [assets, liabilities, netWorth] = $derived(
		await Promise.all([getAssets(), getLiabilities(), getNetWorth()])
	);

	const totalManualAssets = $derived(assets.reduce((s, a) => s + a.value, 0));
	const totalAssets = $derived(totalManualAssets + netWorth.totalValue);
	const totalLiabilities = $derived(liabilities.reduce((s, l) => s + l.balance, 0));

	type Dialog =
		| { kind: 'add-asset' }
		| { kind: 'edit-asset'; asset: Asset }
		| { kind: 'delete-asset'; asset: Asset }
		| { kind: 'add-liability' }
		| { kind: 'edit-liability'; liability: Liability }
		| { kind: 'delete-liability'; liability: Liability }
		| null;

	let dialog = $state<Dialog>(null);
</script>

<svelte:head><title>Balance Sheet | MoneyKit</title></svelte:head>

<svelte:boundary>
	{#snippet pending()}
		<div class="space-y-4">
			{#each [1, 2, 3] as _}<div class="h-20 animate-pulse rounded-2xl bg-muted/60"></div>{/each}
		</div>
	{/snippet}

	<div class="space-y-6">
		<div>
			<h1 class="heading-primary">Balance Sheet</h1>
		</div>

		<BalanceSheetSummary {totalAssets} {totalLiabilities} />

		<div class="grid gap-6 lg:grid-cols-2">
			<!-- Assets -->
			<BalanceSheetSection
				title="Assets"
				total={totalAssets}
				onAdd={() => (dialog = { kind: 'add-asset' })}
				empty={assets.length === 0 ? 'No manual assets yet.' : ''}
			>
				<BalanceSheetRow
					name="Investment Portfolio"
					subtitle="Auto-calculated from portfolios"
					amount={netWorth.totalValue}
					href="/dashboard/portfolios"
				/>

				{#each assets as asset (asset.id)}
					<BalanceSheetRow
						name={asset.name}
						subtitle={asset.category}
						amount={asset.value}
						onEdit={() => (dialog = { kind: 'edit-asset', asset })}
						onDelete={() => (dialog = { kind: 'delete-asset', asset })}
					/>
				{/each}
			</BalanceSheetSection>

			<!-- Liabilities -->
			<BalanceSheetSection
				title="Liabilities"
				total={totalLiabilities}
				onAdd={() => (dialog = { kind: 'add-liability' })}
				empty={liabilities.length === 0 ? 'No liabilities yet.' : ''}
			>
				{#each liabilities as liability (liability.id)}
					<BalanceSheetRow
						name={liability.name}
						subtitle={liability.category + formatPercentage(liability.interestRate)}
						amount={liability.balance}
						onEdit={() => (dialog = { kind: 'edit-liability', liability })}
						onDelete={() => (dialog = { kind: 'delete-liability', liability })}
					/>
				{/each}
			</BalanceSheetSection>
		</div>
	</div>
</svelte:boundary>

<AddAssetDialog
	open={dialog?.kind === 'add-asset'}
	onOpenChange={(open) => (dialog = open ? { kind: 'add-asset' } : null)}
/>
{#if dialog?.kind === 'edit-asset'}
	<EditAssetDialog open onOpenChange={(open) => !open && (dialog = null)} asset={dialog.asset} />
{/if}

<AddLiabilityDialog
	open={dialog?.kind === 'add-liability'}
	onOpenChange={(open) => (dialog = open ? { kind: 'add-liability' } : null)}
/>
{#if dialog?.kind === 'edit-liability'}
	<EditLiabilityDialog
		open
		onOpenChange={(open) => !open && (dialog = null)}
		liability={dialog.liability}
	/>
{/if}

<DeleteDialog
	open={dialog?.kind === 'delete-asset'}
	onOpenChange={(o) => !o && (dialog = null)}
	showTrigger={false}
	label={dialog?.kind === 'delete-asset' ? dialog.asset.name : 'asset'}
	onDelete={async () => {
		if (dialog?.kind === 'delete-asset') {
			await deleteAsset({ id: dialog.asset.id });
			dialog = null;
		}
	}}
/>

<DeleteDialog
	open={dialog?.kind === 'delete-liability'}
	onOpenChange={(o) => !o && (dialog = null)}
	showTrigger={false}
	label={dialog?.kind === 'delete-liability' ? dialog.liability.name : 'liability'}
	onDelete={async () => {
		if (dialog?.kind === 'delete-liability') {
			await deleteLiability({ id: dialog.liability.id });
			dialog = null;
		}
	}}
/>
