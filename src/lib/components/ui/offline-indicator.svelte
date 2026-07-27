<script lang="ts">
	import { onMount } from 'svelte';
	import { WifiOff } from '@lucide/svelte';

	let isOnline = $state(true);

	function updateOnlineStatus() {
		isOnline = navigator.onLine;
	}

	onMount(() => {
		isOnline = navigator.onLine;
		window.addEventListener('online', updateOnlineStatus);
		window.addEventListener('offline', updateOnlineStatus);
		return () => {
			window.removeEventListener('online', updateOnlineStatus);
			window.removeEventListener('offline', updateOnlineStatus);
		};
	});
</script>

{#if !isOnline}
	<div
		class="fixed top-0 left-0 right-0 z-50 flex items-center justify-center gap-2 border-b border-amber-500/20 bg-amber-500/10 px-4 py-1.5 text-xs text-amber-700 backdrop-blur-sm dark:text-amber-400"
	>
		<WifiOff class="size-3.5 shrink-0" />
		<span>You're offline — some features may be limited</span>
		<button
			onclick={() => window.location.reload()}
			class="ml-2 underline underline-offset-2 hover:no-underline"
		>
			Retry
		</button>
	</div>
{/if}
