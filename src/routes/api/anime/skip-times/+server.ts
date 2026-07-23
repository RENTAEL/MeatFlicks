import { json, type RequestHandler } from '@sveltejs/kit';
import { fetchSkipTimestamps } from '$lib/server/services/anime/animeSkip.client';

export const GET: RequestHandler = async ({ url }) => {
	const malId = Number(url.searchParams.get('malId'));
	const episode = Number(url.searchParams.get('episode'));

	if (!malId || !episode) {
		return json({ intro: null, outro: null, recap: null });
	}

	try {
		const timestamps = await fetchSkipTimestamps(malId, episode);
		return json(timestamps);
	} catch {
		return json({ intro: null, outro: null, recap: null });
	}
};
