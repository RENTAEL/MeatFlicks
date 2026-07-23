const ANIME_SKIP_API = 'https://api.anime-skip.com/graphql';

type SkipTimestamps = {
	intro: { start: number; end: number } | null;
	outro: { start: number; end: number } | null;
	recap: { start: number; end: number } | null;
};

const SKIP_QUERY = `
query($malId: Int!, $episode: Int!) {
  findSkipTimes(malId: $malId, episode: $episode) {
    results {
      interval {
        startTime
        endTime
      }
      type
    }
  }
}
`;

export async function fetchSkipTimestamps(malId: number, episode: number): Promise<SkipTimestamps> {
	const result: SkipTimestamps = { intro: null, outro: null, recap: null };

	try {
		const response = await fetch(ANIME_SKIP_API, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				query: SKIP_QUERY,
				variables: { malId, episode }
			}),
			signal: AbortSignal.timeout(5000)
		});

		if (!response.ok) return result;

		const json = await response.json();
		const results = json?.data?.findSkipTimes?.results ?? [];

		for (const r of results) {
			const { startTime, endTime } = r.interval;
			const type = (r.type as string).toLowerCase();
			if (type === 'op' || type === 'opening' || type === 'intro') {
				result.intro = { start: startTime, end: endTime };
			} else if (type === 'ed' || type === 'ending' || type === 'outro') {
				result.outro = { start: startTime, end: endTime };
			} else if (type === 'recap') {
				result.recap = { start: startTime, end: endTime };
			}
		}
	} catch (e) {
		console.warn('[anime-skip] Failed to fetch timestamps:', e);
	}

	return result;
}
