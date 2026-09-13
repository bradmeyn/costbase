<script lang="ts">
	import ScrollArea from '$ui/scroll-area/scroll-area.svelte';

	let {
		data,
		height = '600px'
	}: {
		data: {
			columns: string[];
			rows: (string | number)[][];
		};
		height?: string;
	} = $props();

	const getAlignment = (index: number) => {
		if (index === 0) return 'text-left';
		return 'text-right';
	};
</script>

<ScrollArea class="h-[{height}] w-full overflow-x-auto">
	<table class="w-full">
		<thead class="sticky top-0">
			<tr>
				{#each data.columns as column, i (i)}
					<th class="{getAlignment(i)} p-2">{column}</th>
				{/each}
			</tr>
		</thead>
		<tbody>
			{#each data.rows as row, rowIndex (rowIndex)}
				<tr>
					{#each row as cell, i (i)}
						<td class="p-2 {getAlignment(i)}">
							{cell}
						</td>
					{/each}
				</tr>
			{/each}
		</tbody>
	</table>
</ScrollArea>
