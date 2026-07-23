import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

const PROVIDER_ORDER = [
	'vidcore',
	'vixsrc',
	'streamsrc',
	'2embed.skin',
	'vidlink',
	'vidsrc',
	'2embed',
	'superembed',
	'autoembed',
	'multiembed',
	'embed'
];

const PROVIDERS: Record<string, (tmdbId: string, type: string, season?: string, episode?: string) => string> = {
	vidcore: (id, type, s, e) =>
		type === 'movie'
			? `https://vidcore.org/embed/movie/${id}`
			: `https://vidcore.org/embed/tv/${id}/${s || '1'}/${e || '1'}`,

	vixsrc: (id, type, s, e) =>
		type === 'movie'
			? `https://vixsrc.to/movie/${id}`
			: `https://vixsrc.to/tv/${id}/${s || '1'}/${e || '1'}`,

	streamsrc: (id, type) =>
		type === 'movie'
			? `https://streamsrc.cc/watch/movie/${id}`
			: `https://streamsrc.cc/watch/series/${id}`,

	'2embed.skin': (id, type, s, e) =>
		type === 'movie'
			? `https://2embed.skin/embed/movie/${id}`
			: `https://2embed.skin/embed/tv/${id}/${s || '1'}/${e || '1'}`,

	vidlink: (id, type, s, e) =>
		type === 'movie'
			? `https://vidlink.pro/movie/${id}?primaryColor=63b8bc&secondaryColor=a2a2a2&iconColor=eefdec&icons=default&player=default&title=false&poster=true&autoplay=true&nextbutton=false`
			: type === 'tv'
				? `https://vidlink.pro/tv/${id}/${s || '1'}/${e || '1'}?primaryColor=63b8bc&secondaryColor=a2a2a2&iconColor=eefdec&icons=default&player=default&title=false&poster=true&autoplay=true&nextbutton=false`
				: `https://vidlink.pro/anime/${id}/${e || '1'}/sub?primaryColor=63b8bc&secondaryColor=a2a2a2&iconColor=eefdec&icons=default&player=default&title=false&poster=true&autoplay=true&nextbutton=false`,

	vidsrc: (id, type, s, e) =>
		type === 'movie'
			? `https://vidsrcme.su/embed/movie?tmdb=${id}`
			: `https://vidsrcme.su/embed/tv?tmdb=${id}&season=${s || '1'}&episode=${e || '1'}`,

	'2embed': (id, type, s, e) =>
		type === 'movie'
			? `https://hnembed.cc/embed/movie/${id}`
			: `https://hnembed.cc/embed/tv/${id}/${s || '1'}/${e || '1'}`,

	superembed: (id, type, s, e) =>
		`https://player.autoembed.cc/embed/${type === 'movie' ? 'movie' : 'tv'}/${id}${type !== 'movie' ? `/${s || '1'}/${e || '1'}` : ''}`,

	autoembed: (id, type, s, e) =>
		`https://player.autoembed.cc/embed/${type === 'movie' ? 'movie' : 'tv'}/${id}${type !== 'movie' ? `/${s || '1'}/${e || '1'}` : ''}`,

	multiembed: (id, type, s, e) => {
		const isImdb = /^tt\d+$/.test(id);
		if (type === 'movie')
			return `https://multiembed.mov/movie?${isImdb ? 'imdb' : 'tmdb'}=${id}`;
		return `https://multiembed.mov/tv?${isImdb ? 'imdb' : 'tmdb'}=${id}&s=${s || '1'}&e=${e || '1'}`;
	},

	embed: (id, type) => `https://embed.su/embed/${type}/${id}`
};

async function testProvider(provider: string, tmdbId: string, type: string, season: string, episode: string): Promise<{ url: string; provider: string } | null> {
	const builder = PROVIDERS[provider];
	if (!builder) return null;

	const streamUrl = builder(tmdbId, type, season, episode);

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
	const type = url.searchParams.get('type') || 'movie';
	const season = url.searchParams.get('season') || '1';
	const episode = url.searchParams.get('episode') || '1';

	if (!tmdbId) {
		return json({ error: 'Missing tmdbId' }, { status: 400 });
	}

	const allTested: string[] = [];

	for (const provider of PROVIDER_ORDER) {
		allTested.push(provider);
		const result = await testProvider(provider, tmdbId, type, season, episode);

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