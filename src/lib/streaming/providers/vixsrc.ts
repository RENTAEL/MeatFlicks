import { streamingConfig } from '$lib/config/streaming';
import type { StreamingProvider } from '../types';

const { vixsrc } = streamingConfig;

function buildEmbedUrl(context: Parameters<StreamingProvider['fetchSource']>[0]): string {
	if (context.mediaType === 'movie') {
		return `${vixsrc.baseUrl}/movie/${context.tmdbId}`;
	}
	return `${vixsrc.baseUrl}/tv/${context.tmdbId}/${context.season ?? 1}/${context.episode ?? 1}`;
}

export const vixsrcProvider: StreamingProvider = {
	id: 'vixsrc',
	label: 'VixSrc',
	priority: 45,
	supportedMedia: ['movie', 'tv'],
	async fetchSource(context) {
		if (!context.tmdbId) return null;

		const embedUrl = buildEmbedUrl(context);
		return {
			providerId: 'vixsrc',
			streamUrl: embedUrl,
			embedUrl,
			reliabilityScore: 0.8,
			notes: 'VixSrc embed player.'
		};
	}
};
