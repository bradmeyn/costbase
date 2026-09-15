<script lang="ts">
	import Button from '$ui/button/button.svelte';
	import { buttonVariants } from '$ui/button/index.js';
	import { Paperclip, Loader2 } from '@lucide/svelte';
	import { attachDocument, detachDocument } from '#lib/remotes/import.remote.js';
	import type { Document } from '$db/schemas/portfolio';

	/*
	  The source PDF for one record. A row carries at most one in practice — a contract
	  note, a distribution statement, an AMMA — so this shows the attachment rather
	  than a list, and swapping it means detaching first.
	*/
	let {
		owner,
		ownerId,
		documents = [],
		/**
		 * Read-only shows the link and nothing else. A table row is for reading; changing
		 * what is attached belongs with the record's other edits, not beside every row.
		 */
		readOnly = false
	}: {
		owner: 'transaction' | 'distribution' | 'amitStatement' | 'annualStatement';
		ownerId: string;
		documents?: Document[];
		readOnly?: boolean;
	} = $props();

	const attached = $derived(documents[0]);

	let input = $state<HTMLInputElement | null>(null);
	let busy = $state(false);
	let problem = $state('');

	async function upload(event: Event) {
		const picked = (event.currentTarget as HTMLInputElement).files?.[0];
		if (!picked) return;

		busy = true;
		problem = '';
		try {
			await attachDocument({ owner, ownerId, file: picked });
		} catch (e) {
			problem = e instanceof Error ? e.message : 'That file could not be attached.';
		} finally {
			busy = false;
			if (input) input.value = '';
		}
	}

	async function detach() {
		if (!attached) return;
		busy = true;
		try {
			await detachDocument(attached.id);
		} finally {
			busy = false;
		}
	}
</script>

<span class="inline-flex items-center">
	{#if busy}
		<span class="inline-flex size-8 items-center justify-center text-muted-foreground">
			<Loader2 class="size-4 animate-spin" />
		</span>
	{:else if attached}
		<Button
			variant="ghost"
			size="icon"
			href="/documents/{attached.id}"
			target="_blank"
			rel="noopener"
			title={attached.filename}
			aria-label="Open {attached.filename}"
		>
			<Paperclip class="size-4 text-primary" />
		</Button>
		{#if !readOnly}
			<Button variant="ghost" size="sm" onclick={detach} class="text-muted-foreground">
				Remove
			</Button>
		{/if}
	{:else if !readOnly}
		<!--
			A label rather than a button that clicks a hidden input: one control, so the
			file input itself takes focus and screen readers announce it once.
		-->
		<label
			class="{buttonVariants({ variant: 'ghost', size: 'icon' })} cursor-pointer
				focus-within:ring-[3px] focus-within:ring-ring/50"
			title="Attach a PDF"
		>
			<Paperclip class="size-4 text-muted-foreground" />
			<input
				bind:this={input}
				type="file"
				accept="application/pdf"
				onchange={upload}
				class="sr-only"
				aria-label="Attach a PDF"
			/>
		</label>
	{:else}
		<span class="inline-flex size-9 items-center justify-center text-muted-foreground/30">
			<Paperclip class="size-4" />
		</span>
	{/if}
</span>

{#if problem}
	<p class="mt-1 text-[11px] text-destructive">{problem}</p>
{/if}
