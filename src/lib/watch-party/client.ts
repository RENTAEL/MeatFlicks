export interface StartPartyInput {
	mediaType: 'movie' | 'tv';
	tmdbId: number;
	season?: number;
	episode?: number;
}

export async function createWatchParty(input: StartPartyInput): Promise<string | null> {
	try {
		const res = await fetch('/api/watch-party/rooms', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify(input)
		});
		if (res.status === 401 || res.status === 403) return null;
		if (!res.ok) return null;
		const data = await res.json();
		if (!data?.roomId) return null;
		return data.roomId;
	} catch {
		return null;
	}
}