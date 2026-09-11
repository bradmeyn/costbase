<script lang="ts">
	import { getInsurances, updateInsurance } from '#lib/remotes/insurance.remote.js';
	import * as Dialog from '$ui/dialog';
	import * as Field from '$ui/field';
	import * as NativeSelect from '$ui/native-select';
	import Input from '$ui/input/input.svelte';
	import { Button } from '$ui/button';
	import { OWNERS, INSURANCE_CATEGORIES } from '#lib/constants/categories.js';
	import { FREQUENCIES, FREQUENCY_ENUM } from '#lib/constants/frequencies.js';
	import type { Insurance } from '$db/schemas/budget';

	let {
		open,
		onOpenChange,
		insurance
	}: {
		open: boolean;
		onOpenChange: (open: boolean) => void;
		insurance: Insurance;
	} = $props();

	function toDateInputValue(date: Date | string) {
		return new Date(date).toISOString().split('T')[0];
	}
</script>

<Dialog.Root {open} {onOpenChange}>
	<Dialog.Content>
		<Dialog.Header>
			<Dialog.Title>Edit Insurance</Dialog.Title>
		</Dialog.Header>
		<form
			{...updateInsurance.enhance(async (form) => {
				await form.submit().updates(getInsurances());
				if (form.result?.success) {
					form.element.reset();
					onOpenChange(false);
				}
			})}
			class="space-y-4"
		>
			<input {...updateInsurance.fields.id.as('text')} type="hidden" value={insurance.id} />
			<Field.Field>
				<Field.Label>Name</Field.Label>
				<Input {...updateInsurance.fields.name.as('text')} value={insurance.name} />
				<Field.Error />
			</Field.Field>
			<div class="grid grid-cols-2 gap-3">
				<Field.Field>
					<Field.Label>Provider</Field.Label>
					<Input {...updateInsurance.fields.provider.as('text')} value={insurance.provider} />
					<Field.Error />
				</Field.Field>
				<Field.Field>
					<Field.Label>Type</Field.Label>
					<NativeSelect.Root
						{...updateInsurance.fields.category.as('text')}
						value={insurance.category}
					>
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
						{...updateInsurance.fields.premium.as('text')}
						type="number"
						step="0.01"
						value={insurance.premium / 100}
					/>
					<Field.Error />
				</Field.Field>
				<Field.Field>
					<Field.Label>Frequency</Field.Label>
					<NativeSelect.Root
						{...updateInsurance.fields.frequency.as('text')}
						value={insurance.frequency}
					>
						{#each FREQUENCY_ENUM as f}
							<NativeSelect.Option value={f}>{FREQUENCIES[f].label}</NativeSelect.Option>
						{/each}
					</NativeSelect.Root>
				</Field.Field>
			</div>
			<Field.Field>
				<Field.Label>Renewal Date</Field.Label>
				<Input
					{...updateInsurance.fields.renewalDate.as('date')}
					value={toDateInputValue(insurance.renewalDate)}
				/>
				<Field.Error />
			</Field.Field>
			<Field.Field>
				<Field.Label>Owner</Field.Label>
				<NativeSelect.Root
					{...updateInsurance.fields.owner.as('text')}
					value={insurance.owner ?? OWNERS[0]}
				>
					{#each OWNERS as owner}
						<NativeSelect.Option value={owner}>{owner}</NativeSelect.Option>
					{/each}
				</NativeSelect.Root>
				<Field.Error />
			</Field.Field>
			<div class="flex justify-end gap-2">
				<Button type="button" variant="outline" onclick={() => onOpenChange(false)}>Cancel</Button>
				<Button type="submit" disabled={!!updateInsurance.pending}>Save</Button>
			</div>
		</form>
	</Dialog.Content>
</Dialog.Root>
