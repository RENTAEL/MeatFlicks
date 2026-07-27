import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

const PROVIDERS: Record<string, (tmdbId: string, type: string, season?: string, episode?: string, malId?: string) => string> = {
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

	vidsrcme: (id, type, s, e) =>
		type === 'movie'
			? `https://vidsrcme.su/embed/movie?tmdb=${id}`
			: `https://vidsrcme.su/embed/tv?tmdb=${id}&season=${s || '1'}&episode=${e || '1'}`,

	'2embed': (id, type, s, e) =>
		type === 'movie'
			? `https://hnembed.cc/embed/movie/${id}`
			: `https://hnembed.cc/embed/tv/${id}/${s || '1'}/${e || '1'}`,

	'2embed-skin': (id, type, s, e) =>
		type === 'movie'
			? `https://2embed.skin/embed/movie/${id}`
			: `https://2embed.skin/embed/tv/${id}/${s || '1'}/${e || '1'}`,

	nontongo: (id, type, s, e) =>
		type === 'movie'
			? `https://www.NontonGo.win/embed/movie/${id}`
			: `https://www.NontonGo.win/embed/tv/${id}/${s || '1'}/${e || '1'}`
};

export const GET: RequestHandler = async ({ url }) => {
	const provider = url.searchParams.get('provider') || '';
	const tmdbId = url.searchParams.get('tmdbId') || '';
	const type = url.searchParams.get('type') || 'movie';
	const season = url.searchParams.get('season') || '1';
	const episode = url.searchParams.get('episode') || '1';
	const malId = url.searchParams.get('malId') || '';

	if (!provider || !tmdbId) {
		return json({ error: 'Missing provider or tmdbId' }, { status: 400 });
	}

	const builder = PROVIDERS[provider];
	if (!builder) {
		return json({ error: `Unknown provider: ${provider}` }, { status: 400 });
	}

	const streamUrl = builder(tmdbId, type, season, episode, malId);

	try {
		const controller = new AbortController();
		const timeout = setTimeout(() => controller.abort(), 5000);

		await fetch(streamUrl, {
			method: 'HEAD',
			signal: controller.signal,
			headers: { 'User-Agent': 'Mozilla/5.0' }
		});

		clearTimeout(timeout);
		return json({ url: streamUrl, provider });
	} catch {
		return json({ url: streamUrl, provider, warning: 'Provider may be unreachable' });
	}
};