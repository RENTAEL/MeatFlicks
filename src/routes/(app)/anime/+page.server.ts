import type { PageServerLoad } from './$types';
import { fetchTrendingAnime, fetchTopAiringAnime, fetchSeasonalAnime, fetchSchedule, fetchPopularAnime, mapMiruroToAniwatch, type MiruroAnimeCard } from '$lib/server/services/anime/miruroApi.client';
import { fallbackHome } from '$lib/server/services/anime/animeFallback';
import type { AniwatchHome, SpotlightAnime, TrendCard, LatestEpisode } from '$lib/server/services/anime/animeApi.client';

export const load: PageServerLoad = async () => {
	try {
		const [trending, topAiring, seasonal, schedule, popular] = await Promise.allSettled([
			fetchTrendingAnime(),
			fetchTopAiringAnime(),
			fetchSeasonalAnime(),
			fetchSchedule(),
			fetchPopularAnime()
		]);

		const trendingData = trending.status === 'fulfilled' ? trending.value : [];
		const topAiringData = topAiring.status === 'fulfilled' ? topAiring.value : [];
		const seasonalData = seasonal.status === 'fulfilled' ? seasonal.value : [];
		const scheduleData = schedule.status === 'fulfilled' ? schedule.value : [];
		const popularData = popular.status === 'fulfilled' ? popular.value : [];

		const allData = [...trendingData, ...topAiringData, ...seasonalData, ...popularData];

		if (allData.length === 0) {
			return { home: fallbackHome };
		}

		const home: AniwatchHome = {
			spotLightAnimes: topAiringData.slice(0, 6).map((a, i) => ({
				rank: i + 1,
				id: a.id.toString(),
				name: a.title,
				description: '',
				poster: a.image_url,
				jname: a.title,
				episodes: { sub: a.episodes ?? 0, dub: null },
				type: 'TV',
				otherInfo: []
			})),
			trendingAnimes: trendingData.slice(0, 10).map((a, i) => ({
				rank: i + 1,
				id: a.id.toString(),
				name: a.title,
				poster: a.image_url,
				jname: a.title,
				episodes: { sub: a.episodes ?? 0, dub: null },
				type: 'TV'
			})),
			latestEpisodes: (seasonalData as MiruroAnimeCard[]).slice(0, 10).map((a, i) => ({
				id: a.id.toString(),
				name: a.title,
				jname: a.title,
				poster: a.image_url,
				episode: { sub: i + 1, dub: null },
				type: 'TV'
			})),
			top10Animes: {
				day: popularData.slice(0, 10).map((a, i) => ({
					rank: i + 1,
					id: a.id.toString(),
					name: a.title,
					poster: a.image_url,
					jname: a.title,
					episodes: { sub: a.episodes ?? 0, dub: null },
					type: 'TV'
				})),
				week: trendingData.slice(0, 10).map((a, i) => ({
					rank: i + 1,
					id: a.id.toString(),
					name: a.title,
					poster: a.image_url,
					jname: a.title,
					episodes: { sub: a.episodes ?? 0, dub: null },
					type: 'TV'
				})),
				month: seasonalData.slice(0, 10).map((a, i) => ({
					rank: i + 1,
					id: a.id.toString(),
					name: a.title,
					poster: a.image_url,
					jname: a.title,
					episodes: { sub: a.episodes ?? 0, dub: null },
					type: 'TV'
				}))
			},
			genres: ['Action', 'Adventure', 'Comedy', 'Drama', 'Fantasy', 'Horror', 'Romance', 'Sci-Fi', 'Shounen', 'Slice of Life', 'Sports', 'Thriller']
		};

		return { home };
	} catch (e) {
		console.error('[anime] Failed to load home, using fallback:', e);
		return { home: fallbackHome };
	}
};