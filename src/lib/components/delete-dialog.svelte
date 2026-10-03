<script lang="ts">
	import * as AlertDialog from '#lib/components/ui/alert-dialog/index.js';
	import { Trash } from '@lucide/svelte';
	import { buttonVariants } from '#lib/components/ui/button/index.js';
	import Spinner from '#lib/components/ui/spinner/spinner.svelte';
	import type { Snippet } from 'svelte';

	let {
		label,
		onDelete,
		trigger,
		loading,
		open = $bindable(false),
		onOpenChange,
		showTrigger = true
	}: {
		label: string;
		onDelete: () => Promise<void> | void;
		trigger?: Snippet;
		loading?: boolean;
		open?: boolean;
		onOpenChange?: (open: boolean) => void;
		showTrigger?: boolean;
	} = $props();
	let internalLoading = $state(false);
	const isLoading = $derived(loading ?? internalLoading);

	async function handleDelete() {
		if (!onDelete) return;
		try {
			internalLoading = true;
			await onDelete();
			open = false;
			onOpenChange?.(false);
		} catch (error) {
			console.error('Failed to delete', error);
		} finally {
			internalLoading = false;
		}
	}
</script>

<AlertDialog.Root bind:open {onOpenChange}>
	{#if showTrigger}
		<AlertDialog.Trigger>
			{#if trigger}
				{@render trigger()}
			{:else}
				<button class={buttonVariants({ variant: 'ghost', size: 'sm' })} type="button">
					<Trash class="size-4" />
				</button>
			{/if}
		</AlertDialog.Trigger>
	{/if}
	<AlertDialog.Content>
		<AlertDialog.Header>
			<AlertDialog.Title>Delete {label}</AlertDialog.Title>
			<AlertDialog.Description>
				This action cannot be undone. The {label} and any related data will be permanently removed.
			</AlertDialog.Description>
		</AlertDialog.Header>
		<AlertDialog.Footer>
			<AlertDialog.Cancel disabled={isLoading}>Cancel</AlertDialog.Cancel>
			<AlertDialog.Action
				disabled={isLoading}
				class={buttonVariants({ variant: 'destructive' })}
				onclick={handleDelete}
			>
				{#if isLoading}
					<div class="flex items-center gap-2">
						<Spinner class="size-4" />
						<span>Deleting...</span>
					</div>
				{:else}
					Delete
				{/if}
			</AlertDialog.Action>
		</AlertDialog.Footer>
	</AlertDialog.Content>
</AlertDialog.Root>
