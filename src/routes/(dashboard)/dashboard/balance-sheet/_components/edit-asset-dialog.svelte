<script lang="ts">
	import { getAssets, updateAsset } from '#lib/remotes/balance-sheet.remote.js';
	import * as Dialog from '$ui/dialog';
	import * as Field from '$ui/field';
	import * as NativeSelect from '$ui/native-select';
	import Input from '$ui/input/input.svelte';
	import { Button } from '$ui/button';
	import type { Asset } from '$db/schemas/budget';
	import { OWNERS } from '#lib/constants/categories.js';

	const ASSET_CATEGORIES = ['cash', 'property', 'vehicle', 'other'] as const;

	let {
		open,
		onOpenChange,
		asset
	}: {
		open: boolean;
		onOpenChange: (open: boolean) => void;
		asset: Asset;
	} = $props();
</script>

<Dialog.Root {open} {onOpenChange}>
	<Dialog.Content>
		<Dialog.Header>
			<Dialog.Title>Edit Asset</Dialog.Title>
		</Dialog.Header>
		<form
			{...updateAsset.enhance(async (form) => {
				await form.submit().updates(getAssets());
				if (form.result?.success) {
					form.element.reset();
					onOpenChange(false);
				}
			})}
			class="space-y-4"
		>
			<input {...updateAsset.fields.id.as('text')} type="hidden" value={asset.id} />
			<Field.Field>
				<Field.Label>Name</Field.Label>
				<Input {...updateAsset.fields.name.as('text')} value={asset.name} />
				<Field.Error />
			</Field.Field>
			<div class="grid grid-cols-2 gap-3">
				<Field.Field>
					<Field.Label>Value ($)</Field.Label>
					<Input
						{...updateAsset.fields.amount.as('text')}
						type="number"
						step="0.01"
						value={asset.value / 100}
					/>
					<Field.Error />
				</Field.Field>
				<Field.Field>
					<Field.Label>Category</Field.Label>
					<NativeSelect.Root {...updateAsset.fields.category.as('text')} value={asset.category}>
						{#each ASSET_CATEGORIES as category}
							<NativeSelect.Option value={category}>{category}</NativeSelect.Option>
						{/each}
					</NativeSelect.Root>
				</Field.Field>
			</div>
			<Field.Field>
				<Field.Label>Owner</Field.Label>
				<NativeSelect.Root
					{...updateAsset.fields.owner.as('text')}
					value={asset.owner ?? Object.keys(OWNERS)[0]}
				>
					{#each Object.entries(OWNERS) as [key, label]}
						<NativeSelect.Option value={key}>{label}</NativeSelect.Option>
					{/each}
				</NativeSelect.Root>
			</Field.Field>
			<div class="flex justify-end gap-2">
				<Button type="button" variant="outline" onclick={() => onOpenChange(false)}>Cancel</Button>
				<Button type="submit" disabled={!!updateAsset.pending}>Save</Button>
			</div>
		</form>
	</Dialog.Content>
</Dialog.Root>
