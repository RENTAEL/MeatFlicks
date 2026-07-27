import type { PageServerLoad } from './$types';
import { fetchAnimeInfo, fetchAnimeEpisodes, fetchRelatedAnime, fetchRecommendations, mapMiruroInfoToAniwatch } from '$lib/server/services/anime/miruroApi.client';

const CONSUMET_API = 'https://api.consumet.org/anime/gogoanime';
const ANILIST_API = 'https://graphql.anilist.co';
const JIKAN_API = 'https://api.jikan.moe/v4';

interface AnimeDetail {
	id: string;
	name: string;
	jname: string;
	poster: string;
	description: string;
	stats: {
		rating: string;
		quality: string;
		duration: string;
		episodes: { sub: number; dub: number | null };
		type: string;
	};
	otherInfo: string[];
	seasons: any[];
	relatedAnimes: any[];
	recommendedAnimes: any[];
}

async function fetchFromConsumet(slug: string): Promise<AnimeDetail | null> {
	try {
		const res = await fetch(`${CONSUMET_API}/info/${encodeURIComponent(slug)}`, {
			signal: AbortSignal.timeout(10000)
		});
		if (!res.ok) return null;
		const data = await res.json();
		return {
			id: data.id || slug,
			name: data.title?.romaji || data.title?.english || data.title || 'Unknown',
			jname: data.title?.native || data.title?.romaji || '',
			poster: data.image || '',
			description: (data.description || '').replace(/<[^>]*>/g, ''),
			stats: {
				rating: data.rating ? String(data.rating) : 'N/A',
				quality: 'HD',
				duration: data.duration || 'Unknown',
				episodes: { sub: data.totalEpisodes || data.episodes || 0, dub: null },
				type: data.type || 'TV'
			},
			otherInfo: [data.type || 'TV', ...(data.genres || [])].filter(Boolean),
			seasons: [],
			relatedAnimes: [],
			recommendedAnimes: []
		};
	} catch {
		return null;
	}
}

async function fetchFromAniList(idOrTitle: string): Promise<AnimeDetail | null> {
	try {
		const isNum = /^\d+$/.test(idOrTitle);
		const query = isNum
			? `query ($id: Int) { Media(id: $id, type: ANIME) { id title { romaji english native } coverImage { large } description episodes genres status duration averageScore } }`
			: `query ($search: String) { Media(search: $search, type: ANIME) { id title { romaji english native } coverImage { large } description episodes genres status duration averageScore } }`;

		const res = await fetch(ANILIST_API, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ query, variables: isNum ? { id: parseInt(idOrTitle) } : { search: idOrTitle } }),
			signal: AbortSignal.timeout(10000)
		});
		if (!res.ok) return null;
		const json = await res.json();
		const media = json?.data?.Media;
		if (!media) return null;

		return {
			id: String(media.id),
			name: media.title?.romaji || media.title?.english || 'Unknown',
			jname: media.title?.native || '',
			poster: media.coverImage?.large || '',
			description: (media.description || '').replace(/<[^>]*>/g, ''),
			stats: {
				rating: media.averageScore ? (media.averageScore / 10).toFixed(1) : 'N/A',
				quality: 'HD',
				duration: media.duration ? `${media.duration} min` : 'Unknown',
				episodes: { sub: media.episodes || 0, dub: null },
				type: media.type || 'ANIME'
			},
			otherInfo: [media.status, media.type || 'ANIME', ...(media.genres || [])].filter(Boolean),
			seasons: [],
			relatedAnimes: [],
			recommendedAnimes: []
		};
	} catch {
		return null;
	}
}

async function fetchFromJikan(malId: number): Promise<AnimeDetail | null> {
	try {
		const res = await fetch(`${JIKAN_API}/anime/${malId}`, {
			signal: AbortSignal.timeout(10000)
		});
		if (!res.ok) return null;
		const json = await res.json();
		const anime = json.data;
		if (!anime) return null;

		return {
			id: String(anime.mal_id),
			name: anime.title || 'Unknown',
			jname: anime.title_japanese || '',
			poster: anime.images?.jpg?.large_image_url || anime.images?.jpg?.image_url || '',
			description: (anime.synopsis || '').replace(/<[^>]*>/g, ''),
			stats: {
				rating: anime.score ? anime.score.toFixed(1) : 'N/A',
				quality: 'HD',
				duration: anime.duration || 'Unknown',
				episodes: { sub: anime.episodes || 0, dub: null },
				type: anime.type || 'TV'
			},
			otherInfo: [anime.status, anime.type || 'TV', ...(anime.genres?.map((g: any) => g.name) || [])].filter(Boolean),
			seasons: [],
			relatedAnimes: [],
			recommendedAnimes: []
		};
	} catch {
		return null;
	}
}

export const load: PageServerLoad = async ({ params }) => {
	const { id } = params;

	const isNumeric = /^\d+$/.test(id);
	let animeInfo: AnimeDetail | null = null;
	let episodes: any[] = [];
	let related: any[] = [];
	let recommendations: any[] = [];

	if (isNumeric) {
		const malId = parseInt(id, 10);
		try {
			const [infoResult, epResult, relatedResult, recResult] = await Promise.allSettled([
				fetchAnimeInfo(malId),
				fetchAnimeEpisodes(malId),
				fetchRelatedAnime(malId),
				fetchRecommendations(malId)
			]);

			const miruroInfo = infoResult.status === 'fulfilled' ? infoResult.value : null;
			if (miruroInfo) {
				animeInfo = mapMiruroInfoToAniwatch(miruroInfo);
				animeInfo.id = String(miruroInfo.id);
			}

			episodes = epResult.status === 'fulfilled' ? epResult.value : [];
			related = relatedResult.status === 'fulfilled' ? relatedResult.value : [];
			recommendations = recResult.status === 'fulfilled' ? recResult.value : [];

			if (animeInfo) {
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

				const epError = epResult.status === 'rejected'
					? `Episode source unavailable. Check back later.`
					: null;

				return {
					info: animeInfo,
					episodes,
					episodeError: epError,
					totalEpisodes: episodes.length
				};
			}
		} catch (e) {
			console.error('[anime] Miruro/Jikan failed:', e);
		}
	}

	animeInfo = await fetchFromConsumet(id);
	if (animeInfo) {
		return { info: animeInfo, episodes: [], totalEpisodes: 0 };
	}

	animeInfo = await fetchFromAniList(id);
	if (animeInfo) {
		return { info: animeInfo, episodes: [], totalEpisodes: 0 };
	}

	if (isNumeric) {
		animeInfo = await fetchFromJikan(parseInt(id, 10));
		if (animeInfo) {
			return { info: animeInfo, episodes: [], totalEpisodes: 0 };
		}
	}

	return {
		info: {
			id,
			name: 'Anime',
			jname: '',
			poster: '',
			description: '',
			stats: { rating: 'N/A', quality: 'HD', duration: 'Unknown', episodes: { sub: 0, dub: null }, type: 'TV' },
			otherInfo: [],
			seasons: [],
			relatedAnimes: [],
			recommendedAnimes: []
		},
		episodes: [],
		totalEpisodes: 0,
		error: 'Could not load anime details. Try again later.'
	};
};
