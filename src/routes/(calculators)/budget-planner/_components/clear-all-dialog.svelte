<script lang="ts">
	import * as AlertDialog from '#lib/components/ui/alert-dialog/index.js';

	let {
		text = 'all budget items',
		onDelete,
		open = $bindable(false)
	}: { text?: string; onDelete: () => void; open?: boolean } = $props();

	function handleDelete() {
		onDelete();
		open = false;
	}
</script>

<AlertDialog.Root bind:open>
	<AlertDialog.Content>
		<AlertDialog.Header>
			<AlertDialog.Title>Delete {text}?</AlertDialog.Title>
			<AlertDialog.Description>
				Are you sure you want to delete {text}? This action cannot be undone.
			</AlertDialog.Description>
		</AlertDialog.Header>
		<AlertDialog.Footer>
			<AlertDialog.Cancel>Cancel</AlertDialog.Cancel>
			<AlertDialog.Action
				onclick={handleDelete}
				class="bg-destructive text-white hover:bg-destructive/90"
			>
				Delete all
			</AlertDialog.Action>
		</AlertDialog.Footer>
	</AlertDialog.Content>
</AlertDialog.Root>
