<script lang="ts">
	import { getAssets, addAsset } from '#lib/remotes/balance-sheet.remote.js';
	import * as Dialog from '$ui/dialog';
	import * as Field from '$ui/field';
	import * as NativeSelect from '$ui/native-select';
	import Input from '$ui/input/input.svelte';
	import { Button } from '$ui/button';
	import { OWNERS, ASSET_CATEGORIES } from '#lib/constants/categories.js';

	let { open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void } = $props();
</script>

<Dialog.Root {open} {onOpenChange}>
	<Dialog.Content>
		<Dialog.Header>
			<Dialog.Title>Add Asset</Dialog.Title>
		</Dialog.Header>
		<form
			{...addAsset.enhance(async (form) => {
				await form.submit().updates(getAssets());
				if (form.result?.success) {
					form.element.reset();
					onOpenChange(false);
				}
			})}
			class="space-y-4"
		>
			<Field.Field>
				<Field.Label>Name</Field.Label>
				<Input {...addAsset.fields.name.as('text')} placeholder="e.g., Savings Account" />
				<Field.Error />
			</Field.Field>
			<div class="grid grid-cols-2 gap-3">
				<Field.Field>
					<Field.Label>Value ($)</Field.Label>
					<Input
						{...addAsset.fields.amount.as('text')}
						type="number"
						step="0.01"
						placeholder="0.00"
					/>
					<Field.Error />
				</Field.Field>
				<Field.Field>
					<Field.Label>Category</Field.Label>
					<NativeSelect.Root {...addAsset.fields.category.as('text')}>
						{#each ASSET_CATEGORIES as category}
							<NativeSelect.Option value={category}>{category}</NativeSelect.Option>
						{/each}
					</NativeSelect.Root>
				</Field.Field>
			</div>
			<Field.Field>
				<Field.Label>Owner</Field.Label>
				<NativeSelect.Root {...addAsset.fields.owner.as('text')}>
					{#each Object.entries(OWNERS) as [key, label]}
						<NativeSelect.Option value={key}>{label}</NativeSelect.Option>
					{/each}
				</NativeSelect.Root>
			</Field.Field>
			<div class="flex justify-end gap-2">
				<Button type="button" variant="outline" onclick={() => onOpenChange(false)}>Cancel</Button>
				<Button type="submit" disabled={!!addAsset.pending}>Add</Button>
			</div>
		</form>
	</Dialog.Content>
</Dialog.Root>
