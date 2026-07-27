import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

const PROVIDER_ORDER = [
	'smashystream',
	'streamsrc',
	'vidlink',
	'vidsrc',
	'2embed',
	'2embed-skin',
	'nontongo'
];

const PROVIDERS: Record<string, (tmdbId: string, type: string, season?: string, episode?: string) => string> = {
	smashystream: (id, type, s, e) =>
		type === 'movie'
			? `https://embed.smashystream.com/playere.php?tmdb=${id}`
			: `https://embed.smashystream.com/playere.php?tmdb=${id}&s=${s || '1'}&e=${e || '1'}`,

	streamsrc: (id, type) =>
		type === 'movie'
			? `https://streamsrc.cc/watch/movie/${id}`
			: `https://streamsrc.cc/watch/series/${id}`,

	vidlink: (id, type, s, e) =>
		type === 'movie'
			? `https://vidlink.pro/movie/${id}?primaryColor=63b8bc&secondaryColor=a2a2a2&iconColor=eefdec&icons=default&player=default&title=false&poster=true&autoplay=true&nextbutton=false`
			: type === 'tv'
				? `https://vidlink.pro/tv/${id}/${s || '1'}/${e || '1'}?primaryColor=63b8bc&secondaryColor=a2a2a2&iconColor=eefdec&icons=default&player=default&title=false&poster=true&autoplay=true&nextbutton=false`
				: `https://vidlink.pro/anime/${id}/${e || '1'}/sub?primaryColor=63b8bc&secondaryColor=a2a2a2&iconColor=eefdec&icons=default&player=default&title=false&poster=true&autoplay=true&nextbutton=false`,

	vidsrc: (id, type, s, e) =>
		type === 'movie'
			? `https://vidsrc.to/embed/movie/${id}`
			: `https://vidsrc.to/embed/tv/${id}/${s || '1'}/${e || '1'}`,

	'2embed': (id, type, s, e, mediaId) =>
		type === 'movie'
			? `https://hnembed.cc/embed/movie/${mediaId || id}`
			: `https://hnembed.cc/embed/tv/${mediaId || id}/${s || '1'}/${e || '1'}`,

	'2embed-skin': (id, type, s, e, mediaId) =>
		type === 'movie'
			? `https://2embed.skin/embed/movie/${mediaId || id}`
			: `https://2embed.skin/embed/tv/${mediaId || id}/${s || '1'}/${e || '1'}`,

	nontongo: (id, type, s, e) =>
		type === 'movie'
			? `https://www.NontonGo.win/embed/movie/${id}`
			: `https://www.NontonGo.win/embed/tv/${id}/${s || '1'}/${e || '1'}`
};

async function testProvider(provider: string, tmdbId: string, type: string, season: string, episode: string, imdbId?: string): Promise<{ url: string; provider: string } | null> {
	const builder = PROVIDERS[provider];
	if (!builder) return null;

	const mediaId = imdbId || tmdbId;
	const streamUrl = builder(tmdbId, type, season, episode, mediaId);

	try {
		const controller = new AbortController();
		const timeout = setTimeout(() => controller.abort(), 5000);

		await fetch(streamUrl, {
			method: 'HEAD',
			signal: controller.signal,
			headers: { 'User-Agent': 'Mozilla/5.0' }
		});

		clearTimeout(timeout);
		return { url: streamUrl, provider };
	} catch {
		return null;
	}
}

export const GET: RequestHandler = async ({ url }) => {
	const tmdbId = url.searchParams.get('tmdbId') || '';
	const imdbId = url.searchParams.get('imdbId') || '';
	const type = url.searchParams.get('type') || 'movie';
	const season = url.searchParams.get('season') || '1';
	const episode = url.searchParams.get('episode') || '1';

	const resolvedId = imdbId || tmdbId;

	if (!tmdbId && !imdbId) {
		return json({ error: 'Missing tmdbId or imdbId' }, { status: 400 });
	}

	const allTested: string[] = [];

	for (const provider of PROVIDER_ORDER) {
		allTested.push(provider);
		const result = await testProvider(provider, tmdbId, type, season, episode, imdbId);

		if (result) {
			return json({
				url: result.url,
				provider: result.provider,
				autoSelected: true,
				allTested
			});
		}
	}

	return json(
		{
			error: 'All providers failed',
			tested: allTested
		},
		{ status: 404 }
	);
};