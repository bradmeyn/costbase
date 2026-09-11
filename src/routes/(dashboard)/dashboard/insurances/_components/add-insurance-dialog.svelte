<script lang="ts">
	import { getInsurances, addInsurance } from '#lib/remotes/insurance.remote.js';
	import * as Dialog from '$ui/dialog';
	import * as Field from '$ui/field';
	import * as NativeSelect from '$ui/native-select';
	import Input from '$ui/input/input.svelte';
	import { Button } from '$ui/button';
	import { OWNERS, INSURANCE_CATEGORIES } from '#lib/constants/categories.js';
	import { FREQUENCIES, FREQUENCY_ENUM } from '#lib/constants/frequencies.js';

	let { open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void } = $props();
</script>

<Dialog.Root {open} {onOpenChange}>
	<Dialog.Content>
		<Dialog.Header>
			<Dialog.Title>Add Insurance</Dialog.Title>
		</Dialog.Header>
		<form
			{...addInsurance.enhance(async (form) => {
				await form.submit().updates(getInsurances());
				if (form.result?.success) {
					form.element.reset();
					onOpenChange(false);
				}
			})}
			class="space-y-4"
		>
			<Field.Field>
				<Field.Label>Name</Field.Label>
				<Input {...addInsurance.fields.name.as('text')} placeholder="e.g., Car Insurance" />
				<Field.Error />
			</Field.Field>
			<div class="grid grid-cols-2 gap-3">
				<Field.Field>
					<Field.Label>Provider</Field.Label>
					<Input {...addInsurance.fields.provider.as('text')} placeholder="e.g., NRMA" />
					<Field.Error />
				</Field.Field>
				<Field.Field>
					<Field.Label>Type</Field.Label>
					<NativeSelect.Root {...addInsurance.fields.category.as('text')}>
						{#each INSURANCE_CATEGORIES as c}
							<NativeSelect.Option value={c}>{c}</NativeSelect.Option>
						{/each}
					</NativeSelect.Root>
					<Field.Error />
				</Field.Field>
			</div>
			<div class="grid grid-cols-2 gap-3">
				<Field.Field>
					<Field.Label>Premium ($)</Field.Label>
					<Input
						{...addInsurance.fields.premium.as('text')}
						type="number"
						step="0.01"
						placeholder="0.00"
					/>
					<Field.Error />
				</Field.Field>
				<Field.Field>
					<Field.Label>Frequency</Field.Label>
					<NativeSelect.Root {...addInsurance.fields.frequency.as('text')}>
						{#each FREQUENCY_ENUM as f}
							<NativeSelect.Option value={f}>{FREQUENCIES[f].label}</NativeSelect.Option>
						{/each}
					</NativeSelect.Root>
				</Field.Field>
			</div>
			<Field.Field>
				<Field.Label>Renewal Date</Field.Label>
				<Input {...addInsurance.fields.renewalDate.as('date')} />
				<Field.Error />
			</Field.Field>
			<Field.Field>
				<Field.Label>Owner</Field.Label>
				<NativeSelect.Root {...addInsurance.fields.owner.as('text')}>
					{#each OWNERS as owner}
						<NativeSelect.Option value={owner}>{owner}</NativeSelect.Option>
					{/each}
				</NativeSelect.Root>
				<Field.Error />
			</Field.Field>
			<div class="flex justify-end gap-2">
				<Button type="button" variant="outline" onclick={() => onOpenChange(false)}>Cancel</Button>
				<Button type="submit" disabled={!!addInsurance.pending}>Add</Button>
			</div>
		</form>
	</Dialog.Content>
</Dialog.Root>
