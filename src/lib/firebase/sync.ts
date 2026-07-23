import { authStore } from '$lib/state/stores/authStore.svelte';
import { playbackStore } from '$lib/state/stores/playbackStore.svelte';
import { watchlist } from '$lib/state/stores/watchlistStore.svelte';
import { watchHistory } from '$lib/state/stores/historyStore';

type AnyFn = (...args: any[]) => any;

export function setupCloudSync() {
	authStore.init();

	if ((playbackStore as any).saveProgress) {
		const origSaveProgress = (playbackStore as any).saveProgress as AnyFn;
		(playbackStore as any).saveProgress = (...args: any[]) => {
			origSaveProgress.apply(playbackStore, args);
			const data = args[0];
			if (data?.mediaId && data?.mediaType) {
				const key = `${data.mediaType}:${data.mediaId}`;
				authStore.saveProgressToCloud(key, data);
			}
		};
	}

	if ((watchlist as any).addToWatchlist) {
		const origAdd = (watchlist as any).addToWatchlist as AnyFn;
		(watchlist as any).addToWatchlist = (...args: any[]) => {
			origAdd.apply(watchlist, args);
			if (args[0]) authStore.saveWatchlistToCloud(args[0]);
		};
	}

	if ((watchlist as any).removeFromWatchlist) {
		const origRemove = (watchlist as any).removeFromWatchlist as AnyFn;
		(watchlist as any).removeFromWatchlist = (...args: any[]) => {
			origRemove.apply(watchlist, args);
			if (args[0]) authStore.removeWatchlistFromCloud(args[0]);
		};
	}

	return () => {
		authStore.cleanup();
	};
}
