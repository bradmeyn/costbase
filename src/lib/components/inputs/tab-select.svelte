<script lang="ts">
	let {
		value = $bindable(),
		options,
		name
	}: {
		value: string | number;
		name: string;
		options: {
			value: string;
			label: string;
		}[];
	} = $props();
</script>

<div
	class="inline-flex h-9 w-full items-center justify-center rounded-lg bg-muted p-[3px] text-muted-foreground"
>
	{#each options as option (option.value)}
		<label class="mb-0 flex-1" for={`${name}-tabs-${option.value}`}>
			<input
				type="radio"
				id={`${name}-tabs-${option.value}`}
				name={`${name}-tabs-${option.value}`}
				bind:group={value}
				value={option.value}
				checked={value == option.value}
				class="peer sr-only"
			/>
			<div
				class="flex h-[calc(100%-1px)] items-center justify-center gap-1.5 rounded-md border border-transparent px-2 py-1 text-sm font-medium whitespace-nowrap transition-all focus-visible:border-ring focus-visible:ring-ring/50 data-[state=checked]:border-input
					data-[state=checked]:bg-background data-[state=checked]:text-foreground data-[state=checked]:shadow-sm
					data-[state=unchecked]:text-muted-foreground"
				data-state={value == option.value ? 'checked' : 'unchecked'}
			>
				{option.label}
			</div>
		</label>
	{/each}
</div>
