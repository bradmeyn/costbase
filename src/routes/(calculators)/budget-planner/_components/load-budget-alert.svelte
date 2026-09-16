<!-- Updated LoadBudgetAlert.svelte -->
<script lang="ts">
	import { getBudgetState } from '../budget.svelte';
	import Button from '$ui/button/button.svelte';
	import { X, FileText } from '@lucide/svelte';
	import { slide } from 'svelte/transition';

	let budget = getBudgetState();
</script>

{#if budget.showLoadPrompt}
	<div
		class="fixed top-6 right-6 z-50 w-full max-w-sm"
		transition:slide={{ duration: 300, axis: 'x' }}
	>
		<div class="card rounded-lg p-4 shadow-lg backdrop-blur-sm">
			<div class="flex items-start gap-3">
				<div class="mt-0.5 flex-shrink-0">
					<FileText class="h-5 w-5 text-primary" />
				</div>
				<div class="flex-1">
					<h3 class="text-sm font-semibold text-foreground">Saved Budget Found</h3>
					<p class="mt-1 mb-3 text-xs text-muted-foreground">
						Would you like to load your previously saved budget?
					</p>
					<div class="flex gap-2">
						<Button
							size="sm"
							class="h-auto px-3 py-1.5 text-xs"
							onclick={() => budget.loadBudget()}
						>
							Load Budget
						</Button>
						<Button
							size="sm"
							variant="ghost"
							class="h-auto px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground"
							onclick={() => (budget.showLoadPrompt = false)}
						>
							Dismiss
						</Button>
					</div>
				</div>
				<Button
					onclick={() => (budget.showLoadPrompt = false)}
					variant="ghost"
					size="icon"
					class="-mt-1 -mr-1 h-6 w-6 flex-shrink-0 text-muted-foreground hover:text-foreground"
				>
					<X class="h-4 w-4" />
				</Button>
			</div>
		</div>
	</div>
{/if}
