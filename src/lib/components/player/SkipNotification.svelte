<script lang="ts">
	import { SkipForward } from '@lucide/svelte';

	let {
		type = 'intro',
		visible = false,
		onSkip
	}: {
		type?: string;
		visible: boolean;
		onSkip: () => void;
	} = $props();

	const label = $derived(
		type === 'intro' ? 'Skipping intro...' :
		type === 'outro' ? 'Skipping outro...' :
		type === 'recap' ? 'Skipping recap...' :
		'Skipping...'
	);
</script>

{#if visible}
	<div class="fixed bottom-24 right-6 z-[300] animate-slide-up-fade">
		<button
			type="button"
			class="flex items-center gap-2 rounded-xl bg-pink-600/90 px-4 py-2.5 text-sm font-medium text-white shadow-lg backdrop-blur-sm transition-all hover:bg-pink-500"
			onclick={onSkip}
		>
			<SkipForward class="size-4" />
			{label}
		</button>
	</div>
{/if}
