<script lang="ts">
	import * as Select from '#lib/components/ui/select/index.js';
	import { FREQUENCIES, FREQUENCY_ENUM, type FrequencyType } from '#lib/constants/frequencies.js';

	type Props = {
		value: FrequencyType;
		name?: string;
		id?: string;
		/** Defaults to full width — every use of this sits in a form column. */
		class?: string;
		onchange?: (value: FrequencyType) => void;
	};

	let {
		value = $bindable(),
		id = '',
		name = '',
		class: className = 'w-full',
		onchange
	}: Props = $props();

	// Type assertion to tell TypeScript that the string is actually a FrequencyType
	const handleChange = (value: string) => {
		// Only call onchange if the value is a valid FrequencyType
		if (value as FrequencyType) {
			onchange?.(value as FrequencyType);
		}
	};
</script>

<Select.Root onValueChange={handleChange} {name} type="single" bind:value>
	<Select.Trigger {id} class={className}>
		{value ? FREQUENCIES[value].label : 'Select'}
	</Select.Trigger>
	<Select.Content>
		{#each FREQUENCY_ENUM as freq (freq)}
			<Select.Item value={freq}>
				{FREQUENCIES[freq].label}
			</Select.Item>
		{/each}
	</Select.Content>
</Select.Root>
