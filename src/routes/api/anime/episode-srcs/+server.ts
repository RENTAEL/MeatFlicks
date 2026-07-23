import { json, type RequestHandler } from '@sveltejs/kit';
import { fetchEpisodeSources } from '$lib/server/services/anime/miruroApi.client';

export const GET: RequestHandler = async ({ url }) => {
	const episodeId = url.searchParams.get('id');
	const server = url.searchParams.get('server') ?? 'hd-1';
	const category = (url.searchParams.get('category') ?? 'sub') as 'sub' | 'dub';

	if (!episodeId) {
		return json({ error: 'Missing episode id' }, { status: 400 });
	}

	try {
		const sources = await fetchEpisodeSources(episodeId, server, category);
		return json(sources);
	} catch (e) {
		console.error('[anime] Failed to fetch episode sources:', e);
		return json({
			episodeId,
			sources: [],
			subtitles: []
		});
	}
};