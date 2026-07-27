<script lang="ts">
	import { AlertTriangle, RefreshCw } from '@lucide/svelte';

	let {
		title = 'Something went wrong',
		message = 'An unexpected error occurred. Please try again.',
		onRetry,
	}: {
		title?: string;
		message?: string;
		onRetry?: () => void;
	} = $props();
</script>

<div class="flex flex-col items-center justify-center px-4 py-16 text-center">
	<div class="mb-4 flex size-14 items-center justify-center rounded-full bg-destructive/20">
		<AlertTriangle class="size-7 text-destructive" />
	</div>
	<h3 class="mb-1 text-lg font-semibold text-foreground">{title}</h3>
	<p class="mb-6 max-w-md text-sm text-muted-foreground">{message}</p>
	{#if onRetry}
		<button
			onclick={onRetry}
			class="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition hover:bg-primary/90 active:scale-95"
		>
			<RefreshCw class="size-4" />
			Try Again
		</button>
	{/if}
</div>
