<script lang="ts">
	import CalendarIcon from '@lucide/svelte/icons/calendar';
	import { DateFormatter, type DateValue, getLocalTimeZone } from '@internationalized/date';
	import { cn } from '#lib/utils.js';
	import { buttonVariants } from '#lib/components/ui/button/index.js';
	import { Calendar } from '#lib/components/ui/calendar/index.js';
	import * as Popover from '#lib/components/ui/popover/index.js';

	let {
		value = $bindable(),
		onValueChange
	}: {
		value?: DateValue;
		onValueChange?: (date: DateValue | undefined) => void;
	} = $props();

	const df = new DateFormatter('en-AU', {
		dateStyle: 'medium'
	});

	let contentRef = $state<HTMLElement | null>(null);

	$effect(() => {
		if (value && onValueChange) {
			onValueChange(value);
		}
	});
</script>

<Popover.Root>
	<Popover.Trigger
		class={cn(
			buttonVariants({
				variant: 'outline',
				class: 'w-[280px] justify-start text-start font-normal'
			}),
			!value && 'text-muted-foreground'
		)}
	>
		<CalendarIcon />
		{value ? df.format(value.toDate(getLocalTimeZone())) : 'Pick a date'}
	</Popover.Trigger>
	<Popover.Content bind:ref={contentRef} class="w-auto p-0">
		<Calendar type="single" bind:value captionLayout="dropdown" />
	</Popover.Content>
</Popover.Root>
