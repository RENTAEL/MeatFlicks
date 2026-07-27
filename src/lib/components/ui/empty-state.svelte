<script lang="ts">
	import { SearchX, Film, Bookmark } from '@lucide/svelte';

	let {
		icon = 'search',
		title = 'Nothing here yet',
		message = '',
		action,
		actionLabel,
	}: {
		icon?: 'search' | 'film' | 'bookmark';
		title?: string;
		message?: string;
		action?: () => void;
		actionLabel?: string;
	} = $props();

	const iconMap = { search: SearchX, film: Film, bookmark: Bookmark };
	const Icon = $derived(iconMap[icon]);
</script>

<div class="flex flex-col items-center justify-center px-4 py-16 text-center">
	<div class="mb-4 flex size-14 items-center justify-center rounded-full bg-muted/50">
		<Icon class="size-7 text-muted-foreground" />
	</div>
	<h3 class="mb-1 text-lg font-semibold text-foreground">{title}</h3>
	{#if message}
		<p class="mb-6 max-w-md text-sm text-muted-foreground">{message}</p>
	{/if}
	{#if action && actionLabel}
		<button
			onclick={action}
			class="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition hover:bg-primary/90 active:scale-95"
		>
			{actionLabel}
		</button>
	{/if}
</div>
