import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url }) => {
	const provider = url.searchParams.get('provider') || 'gogoanime';
	const id = url.searchParams.get('id') || '';
	const ep = url.searchParams.get('ep') || '1';

	if (!id) {
		return json({ error: 'No anime ID provided' }, { status: 400 });
	}

	console.log(`[anime-resolve] provider=${provider} id=${id} ep=${ep}`);

	if (provider === 'gogoanime' || provider === 'consumet') {
		try {
			const watchUrl = `https://api.consumet.org/anime/gogoanime/watch/${encodeURIComponent(id)}-episode-${ep}`;
			console.log(`[anime-resolve] Fetching: ${watchUrl}`);
			const res = await fetch(watchUrl, { signal: AbortSignal.timeout(10000) });
			if (res.ok) {
				const data = await res.json();
				if (data.sources?.length > 0) {
					return json({
						url: data.sources[0].url,
						provider: 'gogoanime',
						isM3U8: data.sources[0].isM3U8 || false,
						quality: data.sources[0].quality || 'HD',
					});
				}
			}
		} catch (e: any) {
			console.error(`[anime-resolve] Consumet error: ${e.message}`);
		}
	}

	if (provider === 'zoro' || provider === 'aniwatch') {
		try {
			const res = await fetch(
				`https://api.consumet.org/anime/zoro/watch?episodeId=${encodeURIComponent(id)}&ep=${ep}`,
				{ signal: AbortSignal.timeout(10000) }
			);
			if (res.ok) {
				const data = await res.json();
				if (data.sources?.length > 0) {
					return json({
						url: data.sources[0].url,
						provider: 'zoro',
						isM3U8: data.sources[0].isM3U8 || false,
					});
				}
			}
		} catch {}
	}

	if (provider === 'anify') {
		try {
			const res = await fetch(
				`https://api.anify.tv/sources?providerId=gogoanime&watchId=${encodeURIComponent(id)}&episodeNumber=${ep}&id=${encodeURIComponent(id)}&subType=sub`,
				{ signal: AbortSignal.timeout(10000) }
			);
			if (res.ok) {
				const data = await res.json();
				if (data.sources?.length > 0) {
					return json({
						url: data.sources[0].url,
						provider: 'anify',
						isM3U8: data.sources[0]?.type === 'm3u8',
					});
				}
			}
		} catch {}
	}

	const embedFallbacks: Record<string, string> = {
		gogoanime: `https://gogoanime.llc/${encodeURIComponent(id)}-episode-${ep}`,
		zoro: `https://aniwatchtv.to/watch/${encodeURIComponent(id)}?ep=${ep}`,
	};

	const fallback = embedFallbacks[provider];
	if (fallback) {
		console.log(`[anime-resolve] Using embed fallback: ${fallback}`);
		return json({
			url: fallback,
			provider,
			isM3U8: false,
			isEmbed: true,
		});
	}

	console.error(`[anime-resolve] All providers failed for ${provider}/${id}/${ep}`);
	return json(
		{
			error: 'Anime not found. The streaming source may be unavailable. Try another provider or episode.',
			debug: { provider, id, ep },
		},
		{ status: 404 }
	);
};
