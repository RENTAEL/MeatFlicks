export interface StartPartyInput {
	mediaType: 'movie' | 'tv';
	tmdbId: number;
	season?: number;
	episode?: number;
}

export type StartPartyResult =
	| { ok: true; roomId: string }
	| { ok: false; reason: 'auth' | 'timeout' | 'error' };

const CREATE_TIMEOUT_MS = 10_000;

export async function createWatchParty(input: StartPartyInput): Promise<StartPartyResult> {
	try {
		const res = await fetch('/api/watch-party/rooms', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify(input),
			signal: AbortSignal.timeout(CREATE_TIMEOUT_MS)
		});
		if (res.status === 401 || res.status === 403) return { ok: false, reason: 'auth' };
		if (!res.ok) return { ok: false, reason: 'error' };
		const data = await res.json();
		if (!data?.roomId) return { ok: false, reason: 'error' };
		return { ok: true, roomId: data.roomId };
	} catch (e) {
		const timedOut = e instanceof DOMException && e.name === 'TimeoutError';
		return { ok: false, reason: timedOut ? 'timeout' : 'error' };
	}
}
