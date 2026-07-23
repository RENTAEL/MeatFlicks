import type { PageServerLoad } from './$types';
import { fetchPopularAnime, fetchTopAiringAnime, fetchTopUpcomingAnime, fetchSeasonalAnime, fetchTrendingAnime } from '$lib/server/services/anime/miruroApi.client';

const categoryFetchers: Record<string, (page?: number) => Promise<any[]>> = {
	'popular': fetchPopularAnime,
	'top-airing': fetchTopAiringAnime,
	'top-upcoming': fetchTopUpcomingAnime,
	'seasonal': fetchSeasonalAnime,
	'trending': fetchTrendingAnime
};

export const load: PageServerLoad = async ({ params }) => {
	const { category } = params;
	const fetcher = categoryFetchers[category];

	if (!fetcher) {
		return { category, data: null };
	}

	try {
		const items = await fetcher();
		return {
			category,
			data: {
				animes: items.map((a) => ({
					id: a.id.toString(),
					name: a.title,
					poster: a.image_url,
					jname: a.title,
					episodes: { sub: a.episodes ?? 0, dub: null },
					type: 'TV'
				}))
			}
		};
	} catch (e) {
		console.error(`[anime] Failed to load category ${category}:`, e);
		return { category, data: null };
	}
};