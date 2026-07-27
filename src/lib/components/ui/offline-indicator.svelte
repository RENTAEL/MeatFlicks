<script lang="ts">
	import { onMount } from 'svelte';
	import { WifiOff } from '@lucide/svelte';
	import { Button } from './button';

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
	<div class="fixed top-4 right-4 z-50 animate-in duration-300 slide-in-from-top-2">
		<div
			class="max-w-sm rounded-lg border border-destructive/20 bg-destructive/95 p-3 shadow-lg backdrop-blur-sm"
		>
			<div class="flex items-center gap-3">
				<WifiOff class="text-destructive-foreground size-5 shrink-0" />
				<div class="min-w-0 flex-1">
					<p class="text-destructive-foreground text-sm font-medium">You're offline</p>
					<p class="text-destructive-foreground/70 text-xs">Some features may be limited</p>
				</div>
				<Button
					variant="ghost"
					size="sm"
					class="text-destructive-foreground hover:bg-destructive-foreground/10 h-8 px-2"
					onclick={() => window.location.reload()}
				>
					Retry
				</Button>
			</div>
		</div>
	</div>
{/if}
