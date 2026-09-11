<script lang="ts">
	import * as DropdownMenu from '#lib/components/ui/dropdown-menu/index.js';
	import { EllipsisVertical, Download } from '@lucide/svelte';
	import Button from '$ui/button/button.svelte';

	import { downloadCsv, type CsvData } from '$utils/file-download';
	import type { Snippet } from 'svelte';

	let {
		getCsvData,
		items,
		filename
	}: {
		getCsvData: () => {
			columns: string[];
			rows: (string | number)[][];
		};
		items?: Snippet;
		filename: string;
	} = $props();

	function downloadData(e: Event) {
		e.preventDefault();
		downloadCsv(getCsvData(), filename);
	}
</script>

<DropdownMenu.Root>
	<DropdownMenu.Trigger
		class="inline-flex shrink-0 items-center justify-center gap-2 rounded-md text-sm font-medium outline-none transition-all disabled:pointer-events-none disabled:opacity-50 h-9 w-9 hover:bg-accent hover:text-accent-foreground"
		aria-label="Calculator actions"
	>
		<EllipsisVertical class="size-4" />
	</DropdownMenu.Trigger>
	<DropdownMenu.Content align="end">
		<DropdownMenu.Group>
			<DropdownMenu.Item onSelect={downloadData}>
				<Download /> <span>Download CSV</span>
			</DropdownMenu.Item>

			{@render items?.()}
		</DropdownMenu.Group>
	</DropdownMenu.Content>
</DropdownMenu.Root>
