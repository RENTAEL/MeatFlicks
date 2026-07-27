import { streamingConfig } from '$lib/config/streaming';
import type { StreamingProvider } from '../types';

const { vidBinge, moviesApi, autoEmbed, streamsrc } = streamingConfig;

function buildEmbedUrl(context: Parameters<StreamingProvider['fetchSource']>[0]): string {
	if (context.mediaType === 'movie') {
		return `${autoEmbed.baseUrl}/embed/movie/${context.tmdbId}`;
	} else if (context.mediaType === 'tv') {
		return `${autoEmbed.baseUrl}/embed/tv/${context.tmdbId}/${context.season ?? 1}/${context.episode ?? 1}`;
	}
	return `${autoEmbed.baseUrl}/embed/${context.mediaType}/${context.tmdbId}`;
}

function buildStreamsrcUrl(context: Parameters<StreamingProvider['fetchSource']>[0]): string {
	if (context.mediaType === 'movie') {
		return `${streamsrc.baseUrl}/watch/movie/${context.tmdbId}`;
	}
	return `${streamsrc.baseUrl}/watch/series/${context.tmdbId}`;
}

function buildVidBingeUrl(context: Parameters<StreamingProvider['fetchSource']>[0]): string {
	if (context.mediaType === 'movie') {
		return `${vidBinge.baseUrl}/movie/${context.tmdbId}`;
	} else if (context.mediaType === 'tv') {
		return `${vidBinge.baseUrl}/tv/${context.tmdbId}/${context.season ?? 1}/${context.episode ?? 1}`;
	}
	return `${vidBinge.baseUrl}/movie/${context.tmdbId}`;
}

function buildMoviesApiUrl(context: Parameters<StreamingProvider['fetchSource']>[0]): string {
	if (context.mediaType === 'movie') {
		return `${moviesApi.baseUrl}/movie/${context.tmdbId}`;
	} else if (context.mediaType === 'tv') {
		return `${moviesApi.baseUrl}/tv/${context.tmdbId}/${context.season ?? 1}/${context.episode ?? 1}`;
	}
	return `${moviesApi.baseUrl}/movie/${context.tmdbId}`;
}

async function tryFetchSource(context: Parameters<StreamingProvider['fetchSource']>[0]): Promise<{ providerId: string; streamUrl: string; embedUrl: string } | null> {
	const buildFns = [
		{ id: 'streamsrc', fn: buildStreamsrcUrl },
		{ id: 'vidbinge', fn: buildVidBingeUrl },
		{ id: 'moviesapi', fn: buildMoviesApiUrl }
	];

	for (const { id, fn } of buildFns) {
		try {
			const embedUrl = fn(context);
			const response = await fetch(embedUrl, {
				headers: {
					'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
					Accept: 'text/html,application/xhtml+xml'
				},
				redirect: 'follow',
				signal: AbortSignal.timeout(10000)
			});

			if (response.ok) {
				return {
					providerId: id,
					streamUrl: embedUrl,
					embedUrl
				};
			}
		} catch (e) {
			continue;
		}
	}

	return null;
}

export const superEmbedProvider: StreamingProvider = {
	id: 'superembed',
	label: 'SuperEmbed',
	priority: 20,
	supportedMedia: ['movie', 'tv'],
	async fetchSource(context) {
		if (!context.tmdbId && !context.imdbId && !context.malId) return null;

		const result = await tryFetchSource(context);
		if (result) {
			return {
				providerId: result.providerId,
				streamUrl: result.streamUrl,
				embedUrl: result.embedUrl,
				reliabilityScore: 0.6,
				notes: 'Embed from aggregator provider.'
			};
		}

		const embedUrl = buildStreamsrcUrl(context);
		return {
			providerId: 'streamsrc',
			streamUrl: embedUrl,
			embedUrl,
			reliabilityScore: 0.4,
			notes: 'Fallback to StreamSrc player.'
		};
	}
};