import type { LibraryMedia } from '$lib/types/library';

export type PlaybackProgress = {
	mediaId: string;
	mediaType: 'movie' | 'tv';
	progress: number;
	duration: number;
	seasonNumber?: number;
	episodeNumber?: number;
	updatedAt: number;
	mediaData?: LibraryMedia;
};

const STORAGE_KEY = 'streamium.playback_progress';
const hasStorage = typeof localStorage !== 'undefined';
const COMPLETED_THRESHOLD_PERCENT = 90;
const STALE_MS = 30 * 24 * 60 * 60 * 1000;

export function shouldShowInContinueWatching(p: PlaybackProgress): boolean {
	if (!p.duration || p.duration <= 0) return false;

	const percent = (p.progress / p.duration) * 100;
	if (percent >= COMPLETED_THRESHOLD_PERCENT) return false;
	if (Date.now() - p.updatedAt > STALE_MS) return false;

	const isShortContent = p.duration < 20 * 60;

	if (isShortContent) {
		return p.progress >= 20;
	}

	if (p.mediaType === 'movie') {
		return p.progress >= 120;
	}

	return p.progress >= 60;
}

function readStorage(): Record<string, PlaybackProgress> {
	if (!hasStorage) return {};
	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		return raw ? JSON.parse(raw) : {};
	} catch (error) {
		console.error('[playbackStore] Failed to read storage:', error);
		return {};
	}
}

function persist(data: Record<string, PlaybackProgress>) {
	if (!hasStorage) return;
	try {
		localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
	} catch (error) {
		console.error('[playbackStore] Failed to persist data:', error);
	}
}

export class PlaybackStore {
	progress = $state<Record<string, PlaybackProgress>>(hasStorage ? readStorage() : {});

	saveProgress = (p: PlaybackProgress) => {
		const key = `${p.mediaType}:${p.mediaId}${
			p.mediaType !== 'movie' ? `:s${p.seasonNumber}e${p.episodeNumber}` : ''
		}`;
		this.progress[key] = { ...p, updatedAt: Date.now() };
		this.prune();
		persist(this.progress);
	};

	prune = () => {
		for (const [key, p] of Object.entries(this.progress)) {
			const percent = p.duration > 0 ? (p.progress / p.duration) * 100 : 0;
			if (percent >= COMPLETED_THRESHOLD_PERCENT || Date.now() - p.updatedAt > STALE_MS) {
				delete this.progress[key];
			}
		}
	};

	getLastProgress = (mediaId: string, mediaType: 'movie' | 'tv') => {
		return Object.values(this.progress)
			.filter((p) => p.mediaId === mediaId && p.mediaType === mediaType)
			.sort((a, b) => b.updatedAt - a.updatedAt)[0] || null;
	};

	getProgress = (
		mediaId: string,
		mediaType: 'movie' | 'tv',
		season?: number,
		episode?: number
	) => {
		const key = `${mediaType}:${mediaId}${mediaType !== 'movie' ? `:s${season}e${episode}` : ''}`;
		return this.progress[key] || null;
	};

	getContinueWatching = () => {
		this.prune();
		persist(this.progress);
		return Object.values(this.progress)
			.filter((p) => {
				return shouldShowInContinueWatching(p);
			})
			.sort((a, b) => b.updatedAt - a.updatedAt)
			.map((p) => ({
				...p.mediaData,
				progressPercent: (p.progress / p.duration) * 100,
				progressSeconds: p.progress,
				durationSeconds: p.duration,
				seasonNumber: p.seasonNumber,
				episodeNumber: p.episodeNumber
			}))
			.filter((m) => !!m) as LibraryMedia[];
	};
}

export const playbackStore = new PlaybackStore();
