import { streamingConfig } from '$lib/config/streaming';
import type { StreamingProvider } from '../types';

const { vidcore } = streamingConfig;

function buildEmbedUrl(context: Parameters<StreamingProvider['fetchSource']>[0]): string {
	if (context.mediaType === 'movie') {
		return `${vidcore.baseUrl}/embed/movie/${context.tmdbId}`;
	}
	return `${vidcore.baseUrl}/embed/tv/${context.tmdbId}/${context.season ?? 1}/${context.episode ?? 1}`;
}

export const vidcoreProvider: StreamingProvider = {
	id: 'vidcore',
	label: 'VidCore',
	priority: 50,
	supportedMedia: ['movie', 'tv'],
	async fetchSource(context) {
		if (!context.tmdbId) return null;

		const embedUrl = buildEmbedUrl(context);
		return {
			providerId: 'vidcore',
			streamUrl: embedUrl,
			embedUrl,
			reliabilityScore: 0.85,
			notes: 'VidCore embed player with HLS streaming and subtitle support.'
		};
	}
};
