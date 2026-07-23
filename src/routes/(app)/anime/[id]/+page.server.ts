import type { PageServerLoad } from './$types';
import { fetchAnimeInfo, fetchAnimeEpisodes, fetchRelatedAnime, fetchRecommendations, mapMiruroInfoToAniwatch } from '$lib/server/services/anime/miruroApi.client';

export const load: PageServerLoad = async ({ params }) => {
	const { id } = params;
	const malId = parseInt(id, 10);

	if (isNaN(malId)) {
		return { info: null, episodes: [], totalEpisodes: 0 };
	}

	try {
		const [infoResult, epResult, relatedResult, recResult] = await Promise.allSettled([
			fetchAnimeInfo(malId),
			fetchAnimeEpisodes(malId),
			fetchRelatedAnime(malId),
			fetchRecommendations(malId)
		]);

		const info = infoResult.status === 'fulfilled' ? infoResult.value : null;
		const episodes = epResult.status === 'fulfilled' ? epResult.value : [];
		const related = relatedResult.status === 'fulfilled' ? relatedResult.value : [];
		const recommendations = recResult.status === 'fulfilled' ? recResult.value : [];

		if (!info) {
			return { info: null, episodes: [], totalEpisodes: 0 };
		}

		const animeInfo = mapMiruroInfoToAniwatch(info);
		animeInfo.relatedAnimes = related.map((a) => ({
			id: a.id.toString(),
			name: a.title,
			poster: a.image_url,
			jname: a.title,
			episodes: { sub: a.episodes ?? 0, dub: null },
			type: 'TV'
		}));
		animeInfo.recommendedAnimes = recommendations.map((a) => ({
			id: a.id.toString(),
			name: a.title,
			poster: a.image_url,
			jname: a.title,
			episodes: { sub: a.episodes ?? 0, dub: null },
			type: 'TV'
		}));

		const mappedEpisodes = episodes.map((ep) => ({
			title: ep.title,
			episodeId: ep.id,
			number: ep.number,
			isFiller: false
		}));

		return {
			info: animeInfo,
			episodes: mappedEpisodes,
			totalEpisodes: mappedEpisodes.length
		};
	} catch (e) {
		console.error('[anime] Failed to load anime detail:', e);
		return { info: null, episodes: [], totalEpisodes: 0 };
	}
};