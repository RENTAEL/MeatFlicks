import { WATCH_PARTY_ENABLED, WATCH_PARTY_URL } from '$lib/config/watchParty';
import { page } from '$app/state';

export interface StartPartyInput {
	mediaType: 'movie' | 'tv';
	tmdbId: number;
	season?: number;
	episode?: number;
	title?: string;
}

export type StartPartyResult =
	| { ok: true; roomId: string }
	| { ok: false; reason: 'auth' | 'timeout' | 'error' | 'disabled' };

const CREATE_TIMEOUT_MS = 10_000;

function identity(): { u: string; n: string } {
	const user = page.data.user as { id: string; username: string } | null | undefined;
	return { u: user?.id ?? '', n: user?.username ?? 'Guest' };
}

export async function createWatchParty(input: StartPartyInput): Promise<StartPartyResult> {
	if (!WATCH_PARTY_ENABLED) return { ok: false, reason: 'disabled' };
	try {
		const res = await fetch(`${WATCH_PARTY_URL}/api/watch-party/rooms`, {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ ...input, ...identity() }),
			signal: AbortSignal.timeout(CREATE_TIMEOUT_MS)
		});
		if (res.status === 401 || res.status === 403) return { ok: false, reason: 'auth' };
		if (res.status === 503) return { ok: false, reason: 'disabled' };
		if (!res.ok) return { ok: false, reason: 'error' };
		const data = await res.json();
		if (!data?.roomId) return { ok: false, reason: 'error' };
		return { ok: true, roomId: data.roomId };
	} catch (e) {
		const timedOut = e instanceof DOMException && e.name === 'TimeoutError';
		return { ok: false, reason: timedOut ? 'timeout' : 'error' };
	}
}
