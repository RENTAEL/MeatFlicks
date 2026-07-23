import type { StreamingProvider, StreamingProviderContext, StreamingSource } from './types';
import { primaryProvider } from './providers/primary';
import { secondaryProvider } from './providers/secondary';
import { tertiaryProvider } from './providers/tertiary';
import { superEmbedProvider } from './providers/superembed';
import { vidcoreProvider } from './providers/vidcore';
import { vixsrcProvider } from './providers/vixsrc';

const providers: StreamingProvider[] = [
	vidcoreProvider, // vidcore.org - priority 50
	vixsrcProvider, // vixsrc.to - priority 45
	tertiaryProvider, // vidlink - priority 40
	primaryProvider, // vidsrc - priority 30
	secondaryProvider, // 2embed - priority 25
	superEmbedProvider // superembed/autoembed/multiembed - priority 20
];

function orderProviders(
	context: StreamingProviderContext,
	preferredProviders: string[]
): StreamingProvider[] {
	const preferred = preferredProviders
		.map((id) => providers.find((provider) => provider.id === id))
		.filter((provider): provider is StreamingProvider => Boolean(provider));

	const remaining = providers.filter(
		(provider) =>
			!preferredProviders.includes(provider.id) &&
			provider.supportedMedia.includes(context.mediaType)
	);

	return [
		...preferred.filter((provider) => provider.supportedMedia.includes(context.mediaType)),
		...remaining
	];
}

export function listStreamingProviders(): StreamingProvider[] {
	return providers;
}

export interface ProviderResolution {
	providerId: string;
	label: string;
	success: boolean;
	source?: StreamingSource | null;
	error?: string;
}

export async function collectStreamingSources(
	context: StreamingProviderContext,
	preferredProviders: string[] = [],
	options: {
		parallel?: boolean;
		timeoutMs?: number;
	} = {}
): Promise<ProviderResolution[]> {
	const { parallel = true, timeoutMs = 20000 } = options;
	const orderedProviders = orderProviders(context, preferredProviders);
	const results: ProviderResolution[] = [];

	if (parallel && orderedProviders.length > 1) {
		const promises = orderedProviders.map(async (provider) => {
			try {
				const source = await Promise.race([
					provider.fetchSource(context),
					new Promise<null>((_, reject) =>
						setTimeout(() => reject(new Error('Provider timeout')), timeoutMs)
					)
				]);

				if (source) {
					return {
						providerId: provider.id,
						label: provider.label,
						success: true,
						source
					};
				} else {
					return {
						providerId: provider.id,
						label: provider.label,
						success: false,
						source: null,
						error: 'Provider returned no source.'
					};
				}
			} catch (error: unknown) {
				console.warn(`[streaming][${provider.id}]`, error);
				return {
					providerId: provider.id,
					label: provider.label,
					success: false,
					source: null,
					error: error instanceof Error ? error.message : 'Unknown error'
				};
			}
		});

		const settledResults = await Promise.all(promises);
		return settledResults;
	} else {
		for (const provider of orderedProviders) {
			try {
				const source = await provider.fetchSource(context);
				if (source) {
					results.push({
						providerId: provider.id,
						label: provider.label,
						success: true,
						source
					});
				} else {
					results.push({
						providerId: provider.id,
						label: provider.label,
						success: false,
						source: null,
						error: 'Provider returned no source.'
					});
				}
			} catch (error: unknown) {
				console.warn(`[streaming][${provider.id}]`, error);
				results.push({
					providerId: provider.id,
					label: provider.label,
					success: false,
					source: null,
					error: error instanceof Error ? error.message : 'Unknown error'
				});
			}
		}
	}

	return results;
}

export async function resolveStreamingSource(
	context: StreamingProviderContext,
	preferredProviders: string[] = []
): Promise<StreamingSource | null> {
	const orderedProviders = orderProviders(context, preferredProviders);
	if (orderedProviders.length === 0) return null;

	console.log('[RESOLVE] Providers ordered:', orderedProviders.map(p => `${p.id}(priority:${p.priority})`), 'context:', context);

	const promises = orderedProviders.map(async (provider) => {
		try {
			const source = await provider.fetchSource(context);
			if (!source) {
				console.warn('[RESOLVE] Provider', provider.id, 'returned no source');
				throw new Error(`Provider ${provider.id} returned no source`);
			}
			console.log('[RESOLVE] Provider', provider.id, 'returned source:', source.streamUrl?.substring(0, 100));
			return source;
		} catch (error) {
			console.warn('[RESOLVE] Provider', provider.id, 'failed:', error instanceof Error ? error.message : error);
			throw error;
		}
	});

	try {
		const result = await Promise.any(promises);
		console.log('[RESOLVE] Successfully resolved with provider:', result.providerId);
		return result;
	} catch (error) {
		console.error('[RESOLVE] All providers failed');
		return null;
	}
}

export async function resolveStreamingWithDetails(
	context: StreamingProviderContext,
	preferredProviders: string[] = []
): Promise<{ source: StreamingSource | null; resolutions: ProviderResolution[] }> {
	const resolutions = await collectStreamingSources(context, preferredProviders);
	const success = resolutions.find((resolution) => resolution.success && resolution.source);
	return {
		source: success?.source ?? null,
		resolutions
	};
}