import type { LibraryMedia } from '$lib/types/library';
import { notifications } from './notificationStore';
import { page } from '$app/state';
import { getCsrfTokenClient } from '$lib/utils/csrf.client';
import { impersonationStore } from './impersonationStore.svelte';

export type Media = {
	id: string;
	title: string;
	posterPath: string | null;
	backdropPath: string | null;
	overview: string | null;
	releaseDate: string | null;
	rating: number;
	genres: string[];
	trailerUrl?: string | null;
	media_type?: string;
	mediaType?: string;
	is4K?: boolean;
	isHD?: boolean;
	tmdbId?: number;
	imdbId?: string | null;
	canonicalPath?: string;
	durationMinutes?: number | null;
	collectionId?: number | null;
	addedAt: string;
	season?: number | null;
	episode?: number | null;
};

// Compatibility alias
export type Movie = Media;

type WatchlistCandidate = LibraryMedia | Media | (Partial<Media> & Record<string, unknown>);

const STORAGE_KEY = 'streamium.watchlist';
const hasStorage = typeof localStorage !== 'undefined';

const buildJsonHeadersWithCsrf = async () => {
	const headers: Record<string, string> = { 'Content-Type': 'application/json' };
	const token = await getCsrfTokenClient();
	if (token) {
		headers['X-CSRF-Token'] = token;
	}
	return headers;
};

const normalizeDateString = (value: unknown): string | null => {
	if (typeof value !== 'string') return null;
	const parsed = Date.parse(value);
	if (Number.isNaN(parsed)) return null;
	return new Date(parsed).toISOString();
};

const buildCanonicalPath = (
	payload: Partial<Media> & Record<string, unknown>,
	id: string
): string => {
	const fromPayload = typeof payload.canonicalPath === 'string' ? payload.canonicalPath.trim() : '';
	if (fromPayload) return fromPayload.startsWith('/') ? fromPayload : `/${fromPayload}`;

	const type = payload.mediaType || payload.media_type || 'movie';
	const prefix = type === 'tv' ? '/tv/' : '/movie/';

	const imdbId = typeof payload.imdbId === 'string' ? payload.imdbId.trim() : '';
	if (imdbId) return `${prefix}${imdbId}`;

	const tmdbId =
		typeof payload.tmdbId === 'number' && Number.isFinite(payload.tmdbId) ? payload.tmdbId : null;
	if (tmdbId) return `${prefix}${tmdbId}`;

	return `${prefix}${id}`;
};

const sanitizeMedia = (candidate: unknown): Media | null => {
	if (!candidate || typeof candidate !== 'object') return null;
	const payload = candidate as Partial<Media> & Record<string, unknown>;
	const rawId = payload.id;
	const id = typeof rawId === 'string' ? rawId : String(rawId ?? '');
	const title = typeof payload.title === 'string' ? payload.title : String(payload.title ?? '');

	if (!id) return null;

	const ratingValue = Number(payload.rating ?? 0);
	const addedAt = normalizeDateString(payload.addedAt) ?? new Date().toISOString();
	const tmdbId =
		typeof payload.tmdbId === 'number'
			? payload.tmdbId
			: typeof payload.tmdb_id === 'number'
				? payload.tmdb_id
				: typeof rawId === 'number'
					? rawId
					: undefined;

	return {
		id,
		title,
		posterPath: typeof payload.posterPath === 'string' ? payload.posterPath : null,
		backdropPath: typeof payload.backdropPath === 'string' ? payload.backdropPath : null,
		overview: typeof payload.overview === 'string' ? payload.overview : null,
		releaseDate: typeof payload.releaseDate === 'string' ? payload.releaseDate : null,
		rating: Number.isFinite(ratingValue) ? ratingValue : 0,
		genres: Array.isArray(payload.genres) ? payload.genres.map(String) : [],
		trailerUrl: typeof payload.trailerUrl === 'string' ? payload.trailerUrl : null,
		media_type: typeof payload.media_type === 'string' ? payload.media_type : undefined,
		mediaType: typeof payload.mediaType === 'string' ? payload.mediaType : undefined,
		is4K: payload.is4K === true,
		isHD: typeof payload.isHD === 'boolean' ? payload.isHD : undefined,
		tmdbId,
		imdbId: typeof payload.imdbId === 'string' ? payload.imdbId : null,
		canonicalPath: buildCanonicalPath(payload, id),
		durationMinutes: typeof payload.durationMinutes === 'number' ? payload.durationMinutes : null,
		collectionId: typeof payload.collectionId === 'number' ? payload.collectionId : null,
		season: typeof payload.season === 'number' ? payload.season : null,
		episode: typeof payload.episode === 'number' ? payload.episode : null,
		addedAt
	};
};

const dedupe = (items: Media[]): Media[] =>
	items.reduce<Media[]>((acc, m) => {
		return acc.some((existing) => existing.id === m.id) ? acc : [...acc, m];
	}, []);

const readStorageState = (): { items: Media[]; dirty: boolean } => {
	if (!hasStorage) return { items: [], dirty: false };
	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		if (!raw) return { items: [], dirty: false };
		const parsed = JSON.parse(raw);
		if (Array.isArray(parsed)) {
			// Legacy plain-array format -> treat as guest-only data to upload on login.
			return {
				items: dedupe(parsed.map(sanitizeMedia).filter((m: unknown): m is Media => Boolean(m))),
				dirty: true
			};
		}
		if (parsed && Array.isArray(parsed.items)) {
			return {
				items: dedupe(
					parsed.items.map(sanitizeMedia).filter((m: unknown): m is Media => Boolean(m))
				),
				dirty: parsed.dirty === true
			};
		}
		return { items: [], dirty: false };
	} catch (error) {
		console.error('[watchlist][readStorageState] Failed', error);
		return { items: [], dirty: false };
	}
};

const persistState = (state: { items: Media[]; dirty: boolean }) => {
	if (!hasStorage) return;
	try {
		localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
	} catch (error) {
		console.error('[watchlist][persistState] Failed', error);
	}
};

class WatchlistStore {
	#items = $state<Media[]>([]);
	#dirty = $state(false);
	#loading = $state(false);
	#error = $state<string | null>(null);

	constructor() {
		if (typeof window !== 'undefined') {
			const stored = readStorageState();
			this.#items = stored.items;
			this.#dirty = stored.dirty;
			this.syncFromServer();

			window.addEventListener('storage', (event) => {
				if (event.key === STORAGE_KEY) {
					const next = readStorageState();
					this.#items = next.items;
					this.#dirty = next.dirty;
				}
			});

			window.addEventListener('online', () => {
				this.syncFromServer();
			});
		}
	}

	get items() {
		return this.#items;
	}
	get loading() {
		return this.#loading;
	}
	get error() {
		return this.#error;
	}

	async syncFromServer() {
		if (typeof window === 'undefined') return;
		if (!page.data.user) return;

		this.#loading = true;
		try {
			const headers = await buildJsonHeadersWithCsrf();

			// Upload guest/local-only items that were never persisted server-side.
			// Skip upload when impersonating - don't pollute impersonated user's data
			if (!impersonationStore.isImpersonating && this.#dirty && this.#items.length > 0) {
				for (const item of this.#items) {
					const body: Record<string, unknown> = {};
					if (item.tmdbId) {
						body.tmdbId = item.tmdbId;
						body.mediaType = item.mediaType || item.media_type;
					} else {
						body.mediaId = item.id;
					}
					await fetch('/api/watchlist', {
						method: 'POST',
						headers,
						body: JSON.stringify(body),
						credentials: 'include'
					});
				}
				this.#dirty = false;
			}

			// Server is the source of truth once logged in — always adopt its
			// state, even when empty, so deletions propagate across devices.
			// When impersonating, fetch the impersonated user's watchlist
			let url = '/api/watchlist';
			const impersonatedHeaders: Record<string, string> = {};
			if (impersonationStore.isImpersonating && impersonationStore.current) {
				url = `/api/watchlist?impersonate=${impersonationStore.current.id}`;
				// Also send header for compatibility
				impersonatedHeaders['X-Impersonate-User'] = impersonationStore.current.id;
			}
			const fetchHeaders = { ...headers, ...impersonatedHeaders };
			// Use impersonation headers if needed, otherwise regular fetch
			const response = await fetch(url, {
				credentials: 'include',
				headers: impersonatedHeaders['X-Impersonate-User'] ? fetchHeaders : undefined
			});
			if (response.ok) {
				const serverMedia = await response.json();
				const sanitized = dedupe(
					serverMedia.map(sanitizeMedia).filter((m: Media | null): m is Media => Boolean(m))
				);
				this.#items = sanitized;
				this.#dirty = false;
				// Don't persist impersonated data to localStorage
				if (!impersonationStore.isImpersonating) {
					persistState({ items: sanitized, dirty: false });
				}
			}
		} catch (error) {
			console.error('[watchlist][syncFromServer] Failed', error);
		} finally {
			this.#loading = false;
		}
	}

	isInWatchlist(mediaId: string): boolean {
		return this.#items.some((m) => m.id === mediaId || String(m.tmdbId ?? '') === mediaId);
	}

	async addToWatchlist(mediaItem: WatchlistCandidate) {
		const sanitized = sanitizeMedia(mediaItem);
		if (!sanitized) {
			this.#error = 'Missing media data';
			return;
		}

		const previousWatchlist = [...this.#items];
		const existingIndex = this.#items.findIndex((item) => item.id === sanitized.id);

		if (existingIndex >= 0) {
			this.#items[existingIndex] = {
				...sanitized,
				addedAt: this.#items[existingIndex].addedAt
			};
		} else {
			this.#items.push(sanitized);
		}

		if (!page.data.user) {
			// Guest: keep locally and mark dirty so it uploads on the next login.
			this.#dirty = true;
			persistState({ items: this.#items, dirty: true });
			if (existingIndex < 0) {
				notifications.mediaAdded({
					title: sanitized.title,
					posterPath: sanitized.posterPath,
					tmdbId: sanitized.tmdbId ?? 0
				});
			}
			return;
		}

		persistState({ items: this.#items, dirty: this.#dirty });

		try {
			const body: Record<string, unknown> = {};
			if (sanitized.tmdbId) {
				body.tmdbId = sanitized.tmdbId;
				body.mediaType = sanitized.mediaType || sanitized.media_type;
			} else {
				body.mediaId = sanitized.id;
			}

			const response = await fetch('/api/watchlist', {
				method: 'POST',
				headers: await buildJsonHeadersWithCsrf(),
				body: JSON.stringify(body),
				credentials: 'include'
			});

			if (!response.ok) throw new Error('Failed to sync');

			if (existingIndex < 0) {
				notifications.mediaAdded({
					title: sanitized.title,
					posterPath: sanitized.posterPath,
					tmdbId: sanitized.tmdbId ?? 0
				});
			}
		} catch (error) {
			this.#items = previousWatchlist;
			persistState({ items: this.#items, dirty: this.#dirty });
			notifications.error('Sync Error', 'Failed to save to server.');
		}
	}

	async removeFromWatchlist(mediaId: string) {
		const previousWatchlist = [...this.#items];
		const item = this.#items.find((m) => m.id === mediaId);
		const title = item?.title ?? 'Item';

		this.#items = this.#items.filter((m) => m.id !== mediaId);
		persistState({ items: this.#items, dirty: this.#dirty });

		if (!page.data.user) {
			notifications.info('Removed', `Removed "${title}" from watchlist.`);
			return;
		}

		try {
			const body: Record<string, unknown> = {};
			if (item?.tmdbId) {
				body.tmdbId = item.tmdbId;
				body.mediaType = item.mediaType || item.media_type;
			} else {
				body.mediaId = mediaId;
			}

			const response = await fetch('/api/watchlist', {
				method: 'DELETE',
				headers: await buildJsonHeadersWithCsrf(),
				body: JSON.stringify(body),
				credentials: 'include'
			});

			if (!response.ok) throw new Error('Failed to sync');
			notifications.info('Removed', `Removed "${title}" from watchlist.`);
		} catch (error) {
			this.#items = previousWatchlist;
			persistState({ items: this.#items, dirty: this.#dirty });
			notifications.error('Sync Error', 'Failed to remove from server.');
		}
	}

	async clear() {
		this.#items = [];
		persistState({ items: [], dirty: this.#dirty });

		if (!page.data.user) return;

		try {
			await fetch('/api/watchlist', {
				method: 'DELETE',
				headers: await buildJsonHeadersWithCsrf(),
				body: JSON.stringify({ clearAll: true }),
				credentials: 'include'
			});
		} catch (error) {
			console.error('[watchlist][clear] Sync failed', error);
		}
	}

	exportData() {
		return $state.snapshot(this.#items);
	}

	replaceAll(items: Media[]) {
		const sanitized = dedupe(
			items.map(sanitizeMedia).filter((m: Media | null): m is Media => Boolean(m))
		);

		this.#items = sanitized;
		this.#dirty = false;
		persistState({ items: sanitized, dirty: false });
	}
}

export const watchlist = new WatchlistStore();
