import { page } from '$app/state';
import { getCsrfTokenClient } from '$lib/utils/csrf.client';
import type { Media } from './watchlistStore.svelte';

export type HistoryEntry = Omit<Media, 'addedAt'> & {
	watchedAt: string;
	mediaType?: string;
	season?: number;
	episode?: number;
};

const STORAGE_KEY = 'streamium.history';
const hasStorage = typeof localStorage !== 'undefined';

const buildJsonHeadersWithCsrf = async () => {
	const headers: Record<string, string> = { 'Content-Type': 'application/json' };
	const token = await getCsrfTokenClient();
	if (token) {
		headers['X-CSRF-Token'] = token;
	}
	return headers;
};

const resolveCanonicalPath = (
	payload: Partial<Media> & Record<string, unknown>,
	id: string
): string => {
	const provided = typeof payload.canonicalPath === 'string' ? payload.canonicalPath.trim() : '';
	if (provided) {
		return provided.startsWith('/') ? provided : `/${provided}`;
	}

	const type = payload.mediaType || payload.media_type || 'movie';
	const prefix = type === 'tv' ? '/tv/' : '/movie/';

	const imdbId = typeof payload.imdbId === 'string' ? payload.imdbId.trim() : '';
	if (imdbId) {
		return `${prefix}${imdbId}`;
	}

	const tmdbId =
		typeof payload.tmdbId === 'number' && Number.isFinite(payload.tmdbId) ? payload.tmdbId : null;

	if (tmdbId) {
		return `${prefix}${tmdbId}`;
	}

	return `${prefix}${id}`;
};

const sanitizeEntry = (candidate: unknown): HistoryEntry | null => {
	if (!candidate || typeof candidate !== 'object') {
		return null;
	}

	const payload = candidate as Partial<HistoryEntry> & Record<string, unknown>;
	const id = typeof payload.id === 'string' ? payload.id : String(payload.id ?? '');
	const title = typeof payload.title === 'string' ? payload.title : String(payload.title ?? '');
	const watchedAt =
		typeof payload.watchedAt === 'string'
			? payload.watchedAt
			: String(payload.watchedAt ?? new Date().toISOString());

	if (!id) {
		return null;
	}

	const ratingValue = Number(payload.rating ?? 0);

	return {
		id,
		title,
		posterPath: typeof payload.posterPath === 'string' ? payload.posterPath : '',
		backdropPath: typeof payload.backdropPath === 'string' ? payload.backdropPath : '',
		overview: typeof payload.overview === 'string' ? payload.overview : '',
		releaseDate: typeof payload.releaseDate === 'string' ? payload.releaseDate : '',
		rating: Number.isFinite(ratingValue) ? ratingValue : 0,
		genres: Array.isArray(payload.genres) ? payload.genres.map(String) : [],
		trailerUrl: typeof payload.trailerUrl === 'string' ? payload.trailerUrl : undefined,
		tmdbId: typeof payload.tmdbId === 'number' ? payload.tmdbId : undefined,
		imdbId: typeof payload.imdbId === 'string' ? payload.imdbId : null,
		canonicalPath: resolveCanonicalPath(payload, id),
		durationMinutes: typeof payload.durationMinutes === 'number' ? payload.durationMinutes : null,
		collectionId: typeof payload.collectionId === 'number' ? payload.collectionId : null,
		is4K: payload.is4K === true,
		isHD: typeof payload.isHD === 'boolean' ? payload.isHD : undefined,
		media_type: typeof payload.media_type === 'string' ? payload.media_type : undefined,
		season: typeof payload.season === 'number' ? payload.season : undefined,
		episode: typeof payload.episode === 'number' ? payload.episode : undefined,
		watchedAt
	} satisfies HistoryEntry;
};

const dedupe = (entries: HistoryEntry[]): HistoryEntry[] =>
	entries.reduce<HistoryEntry[]>((acc, e) => {
		return acc.some((existing) => existing.id === e.id) ? acc : [...acc, e];
	}, []);

const readStorageState = (): { entries: HistoryEntry[]; dirty: boolean } => {
	if (!hasStorage) {
		return { entries: [], dirty: false };
	}

	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		if (!raw) {
			return { entries: [], dirty: false };
		}

		const parsed = JSON.parse(raw);
		if (Array.isArray(parsed)) {
			// Legacy plain-array format -> treat as guest-only data to upload on login.
			return {
				entries: dedupe(
					parsed
						.map(sanitizeEntry)
						.filter((entry: unknown): entry is HistoryEntry => Boolean(entry))
				).sort((a, b) => (a.watchedAt > b.watchedAt ? -1 : 1)),
				dirty: true
			};
		}

		if (parsed && Array.isArray(parsed.entries)) {
			return {
				entries: dedupe(
					parsed.entries
						.map(sanitizeEntry)
						.filter((entry: unknown): entry is HistoryEntry => Boolean(entry))
				).sort((a, b) => (a.watchedAt > b.watchedAt ? -1 : 1)),
				dirty: parsed.dirty === true
			};
		}

		return { entries: [], dirty: false };
	} catch (error) {
		console.error('[history][readStorageState] Failed to parse persisted data', error);
		return { entries: [], dirty: false };
	}
};

const persistState = (state: { entries: HistoryEntry[]; dirty: boolean }) => {
	if (!hasStorage) {
		return;
	}

	try {
		localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
	} catch (error) {
		console.error('[history][persistState] Failed to write data', error);
	}
};

class HistoryStore {
	#entries = $state<HistoryEntry[]>([]);
	#dirty = $state(false);
	#loading = $state(false);
	#error = $state<string | null>(null);

	constructor() {
		if (typeof window !== 'undefined') {
			const stored = readStorageState();
			this.#entries = stored.entries;
			this.#dirty = stored.dirty;
			this.syncFromServer();

			window.addEventListener('storage', (event) => {
				if (event.key === STORAGE_KEY) {
					const next = readStorageState();
					this.#entries = next.entries;
					this.#dirty = next.dirty;
				}
			});

			window.addEventListener('online', () => {
				this.syncFromServer();
			});
		}
	}

	get entries() {
		return this.#entries;
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

			// Upload guest/local-only history that was never persisted server-side.
			if (this.#dirty && this.#entries.length > 0) {
				for (const entry of this.#entries) {
					const body: Record<string, unknown> = {};
					const tmdbIdVal = entry.tmdbId;
					if (tmdbIdVal) {
						body.tmdb_id = Number(tmdbIdVal);
						body.media_type = entry.mediaType || entry.media_type || 'movie';
					} else {
						body.mediaId = entry.id;
					}
					await fetch('/api/history', {
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
			const response = await fetch('/api/history', { credentials: 'include' });
			if (response.ok) {
				const serverHistory = await response.json();
				const sanitized = dedupe(
					serverHistory
						.map(sanitizeEntry)
						.filter((entry: HistoryEntry | null): entry is HistoryEntry => Boolean(entry))
				).sort((a, b) => (a.watchedAt > b.watchedAt ? -1 : 1));

				this.#entries = sanitized;
				this.#dirty = false;
				persistState({ entries: sanitized, dirty: false });
			}
		} catch (error) {
			console.error('[history][syncFromServer] Failed', error);
		} finally {
			this.#loading = false;
		}
	}

	async recordWatch(media: Partial<Media> & Record<string, unknown>) {
		const id = typeof media.id === 'string' ? media.id : String(media.id ?? '');
		if (!id) return;

		const timestamp = new Date().toISOString();
		const entry = sanitizeEntry({ ...media, watchedAt: timestamp });

		if (!entry) return;

		// Optimistic update
		this.#entries = [entry, ...this.#entries.filter((e) => e.id !== entry.id)].sort((a, b) =>
			a.watchedAt > b.watchedAt ? -1 : 1
		);
		persistState({ entries: this.#entries, dirty: this.#dirty });

		if (!page.data.user) {
			this.#dirty = true;
			persistState({ entries: this.#entries, dirty: true });
			return;
		}

		try {
			const body: Record<string, unknown> = {};
			const tmdbIdVal = entry.tmdbId ?? (media as Record<string, unknown>).tmdb_id;
			if (tmdbIdVal) {
				body.tmdb_id = Number(tmdbIdVal);
				body.media_type = entry.mediaType || entry.media_type || 'movie';
			} else {
				body.mediaId = entry.id;
			}

			const response = await fetch('/api/history', {
				method: 'POST',
				headers: await buildJsonHeadersWithCsrf(),
				body: JSON.stringify(body),
				credentials: 'include'
			});

			if (!response.ok) {
				console.warn('[history] Endpoint returned', response.status, '— will retry on next watch');
			}
		} catch (error) {
			console.warn('[history] Network error — will retry on next watch', error);
		}
	}

	async remove(mediaId: string) {
		this.#entries = this.#entries.filter((entry) => entry.id !== mediaId);
		persistState({ entries: this.#entries, dirty: this.#dirty });
	}

	async clear() {
		this.#entries = [];
		persistState({ entries: [], dirty: this.#dirty });

		if (!page.data.user) return;

		try {
			await fetch('/api/history', {
				method: 'DELETE',
				headers: await buildJsonHeadersWithCsrf(),
				credentials: 'include'
			});
		} catch (error) {
			console.error('[history][clear] Sync failed', error);
		}
	}

	exportData() {
		return $state.snapshot(this.#entries);
	}

	replaceAll(entries: HistoryEntry[]) {
		const sanitized = dedupe(
			entries.map(sanitizeEntry).filter((entry): entry is HistoryEntry => Boolean(entry))
		).sort((a, b) => (a.watchedAt > b.watchedAt ? -1 : 1));

		this.#entries = sanitized;
		this.#dirty = false;
		persistState({ entries: sanitized, dirty: false });
	}
}

export const watchHistory = new HistoryStore();
