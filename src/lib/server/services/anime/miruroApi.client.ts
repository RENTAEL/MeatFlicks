const JIKAN_BASE_URL = 'https://api.jikan.moe/v4';
const MIRURO_BASE_URL = 'https://mirurotvapi.vercel.app';

const CACHE_TTL = 5 * 60 * 1000;

interface CacheEntry<T> {
	data: T;
	timestamp: number;
}

const cache = new Map<string, CacheEntry<any>>();

function getCached<T>(key: string): T | null {
	const entry = cache.get(key);
	if (!entry) return null;
	if (Date.now() - entry.timestamp > CACHE_TTL) {
		cache.delete(key);
		return null;
	}
	return entry.data as T;
}

function setCached<T>(key: string, data: T): void {
	cache.set(key, { data, timestamp: Date.now() });
}

async function jikanFetch<T>(path: string): Promise<T> {
	const cached = getCached<T>(path);
	if (cached) return cached;

	const url = `${JIKAN_BASE_URL}${path}`;
	const response = await fetch(url, {
		headers: { 'User-Agent': 'Streamium/1.0' },
		signal: AbortSignal.timeout(15000)
	});

	if (!response.ok) {
		throw new Error(`Jikan API ${response.status}: ${response.statusText}`);
	}

	const data = (await response.json()) as T;
	setCached(path, data);
	return data;
}

async function miruroFetch<T>(path: string): Promise<T> {
	const url = `${MIRURO_BASE_URL}${path}`;
	const response = await fetch(url, {
		headers: { 'User-Agent': 'Streamium/1.0' },
		signal: AbortSignal.timeout(15000)
	});

	if (!response.ok) {
		throw new Error(`Miruro API ${response.status}: ${response.statusText}`);
	}

	return response.json() as Promise<T>;
}

export type MiruroTrendingResponse = {
	anime: MiruroAnimeCard[];
};

export type MiruroAnimeCard = {
	id: number;
	title: string;
	image_url: string;
	rating?: number | string;
	episodes?: number;
	status?: string;
	score?: number;
};

export type MiruroAnimeInfo = {
	id: number;
	title: string;
	title_english?: string;
	title_japanese?: string;
	image_url: string;
	synopsis?: string;
	episodes?: number;
	score?: number;
	rating?: string;
	status?: string;
	type?: string;
	airing?: boolean;
	aired?: { from?: string; to?: string };
	duration?: string;
	rank?: number;
	popularity?: number;
	genres?: { name: string }[];
	studios?: { name: string }[];
	sources?: string[];
	related?: {
		adaptation?: { name: string; url: string }[];
		prequel?: { name: string; url: string }[];
		sequel?: { name: string; url: string }[];
		side_story?: { name: string; url: string }[];
	};
};

export type MiruroEpisode = {
	id: string;
	number: number;
	title: string;
};

export type MiruroStreamSource = {
	quality: string;
	url: string;
	isM3U8: boolean;
};

export type MiruroStreamResponse = {
	episodeId: string;
	sources: MiruroStreamSource[];
	subtitles?: { lang: string; url: string }[];
};

export async function fetchTrendingAnime(): Promise<MiruroAnimeCard[]> {
	try {
		const data = await miruroFetch<MiruroTrendingResponse>('/anime/trending');
		return data.anime ?? [];
	} catch (e) {
		console.warn('[miruro] Failed to fetch trending, falling back to Jikan:', e);
		return fetchTrendingAnimeJikan();
	}
}

async function fetchTrendingAnimeJikan(): Promise<MiruroAnimeCard[]> {
	const data = await jikanFetch<{ data: any[] }>('/top/anime?limit=20&filter=airing');
	return data.data.map((anime) => ({
		id: anime.mal_id,
		title: anime.title,
		image_url: anime.images?.jpg?.image_url ?? '',
		rating: anime.rating,
		episodes: anime.episodes,
		status: anime.status,
		score: anime.score
	}));
}

export async function searchAnime(keyword: string, page = 1): Promise<MiruroAnimeCard[]> {
	const data = await jikanFetch<{ data: any[]; pagination: any }>(
		`/anime?limit=24&page=${page}&q=${encodeURIComponent(keyword)}`
	);
	return data.data.map((anime) => ({
		id: anime.mal_id,
		title: anime.title,
		image_url: anime.images?.jpg?.image_url ?? '',
		rating: anime.rating,
		episodes: anime.episodes,
		status: anime.status,
		score: anime.score
	}));
}

export async function fetchAnimeInfo(malId: number): Promise<MiruroAnimeInfo> {
	try {
		const data = await miruroFetch<MiruroAnimeInfo>(`/anime/info?id=${malId}`);
		return data;
	} catch (e) {
		console.warn('[miruro] Failed to fetch anime info, falling back to Jikan:', e);
		return fetchAnimeInfoJikan(malId);
	}
}

async function fetchAnimeInfoJikan(malId: number): Promise<MiruroAnimeInfo> {
	const data = await jikanFetch<{ data: any }>(`/anime/${malId}`);
	const anime = data.data;
	return {
		id: anime.mal_id,
		title: anime.title,
		title_english: anime.title_english,
		title_japanese: anime.title_japanese,
		image_url: anime.images?.jpg?.image_url ?? '',
		synopsis: anime.synopsis,
		episodes: anime.episodes,
		score: anime.score,
		rating: anime.rating,
		status: anime.status,
		type: anime.type,
		airing: anime.airing,
		aired: anime.aired,
		duration: anime.duration,
		rank: anime.rank,
		popularity: anime.popularity,
		genres: anime.genres ?? [],
		studios: anime.studios ?? [],
		sources: anime.sources ?? []
	};
}

export async function fetchAnimeEpisodes(malId: number): Promise<MiruroEpisode[]> {
	try {
		const data = await miruroFetch<{ episodes: MiruroEpisode[] }>(`/anime/episodes?id=${malId}`);
		return data.episodes ?? [];
	} catch (e) {
		console.warn('[miruro] Failed to fetch episodes, falling back to Jikan:', e);
		return fetchAnimeEpisodesJikan(malId);
	}
}

async function fetchAnimeEpisodesJikan(malId: number): Promise<MiruroEpisode[]> {
	const data = await jikanFetch<{ data: any[] }>(`/anime/${malId}/episodes?limit=1000`);
	return data.data.map((ep) => ({
		id: `mal-${malId}-${ep.mal_id ?? ep.episode}`,
		number: ep.episode,
		title: ep.title
	}));
}

export async function fetchEpisodeSources(
	episodeId: string,
	server = 'hd-1',
	category: 'sub' | 'dub' = 'sub'
): Promise<MiruroStreamResponse> {
	return miruroFetch<MiruroStreamResponse>(
		`/anime/stream?id=${episodeId}&server=${server}&category=${category}`
	);
}

export async function fetchSchedule(): Promise<MiruroAnimeCard[]> {
	try {
		const data = await miruroFetch<{ schedule: MiruroAnimeCard[] }>('/anime/schedule');
		return data.schedule ?? [];
	} catch (e) {
		console.warn('[miruro] Failed to fetch schedule, falling back to Jikan:', e);
		return fetchScheduleJikan();
	}
}

async function fetchScheduleJikan(): Promise<MiruroAnimeCard[]> {
	const day = new Date().getDay();
	const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
	const data = await jikanFetch<{ data: any[] }>(`/schedules?filter=${dayNames[day]}&limit=20`);
	return data.data.map((anime) => ({
		id: anime.mal_id,
		title: anime.title,
		image_url: anime.images?.jpg?.image_url ?? '',
		rating: anime.rating,
		episodes: anime.episodes,
		status: anime.status,
		score: anime.score
	}));
}

export async function fetchPopularAnime(page = 1): Promise<MiruroAnimeCard[]> {
	const data = await jikanFetch<{ data: any[] }>(`/top/anime?limit=24&page=${page}&filter=popular`);
	return data.data.map((anime) => ({
		id: anime.mal_id,
		title: anime.title,
		image_url: anime.images?.jpg?.image_url ?? '',
		rating: anime.rating,
		episodes: anime.episodes,
		status: anime.status,
		score: anime.score
	}));
}

export async function fetchTopAiringAnime(): Promise<MiruroAnimeCard[]> {
	const data = await jikanFetch<{ data: any[] }>('/top/anime?limit=20&filter=airing');
	return data.data.map((anime) => ({
		id: anime.mal_id,
		title: anime.title,
		image_url: anime.images?.jpg?.image_url ?? '',
		rating: anime.rating,
		episodes: anime.episodes,
		status: anime.status,
		score: anime.score
	}));
}

export async function fetchTopUpcomingAnime(): Promise<MiruroAnimeCard[]> {
	const data = await jikanFetch<{ data: any[] }>('/top/anime?limit=20&filter=upcoming');
	return data.data.map((anime) => ({
		id: anime.mal_id,
		title: anime.title,
		image_url: anime.images?.jpg?.image_url ?? '',
		rating: anime.rating,
		episodes: anime.episodes,
		status: anime.status,
		score: anime.score
	}));
}

export async function fetchSeasonalAnime(): Promise<MiruroAnimeCard[]> {
	const year = new Date().getFullYear();
	const season = ['winter', 'spring', 'summer', 'fall'][Math.floor(new Date().getMonth() / 3)] as
		| 'winter'
		| 'spring'
		| 'summer'
		| 'fall';
	const data = await jikanFetch<{ data: any[] }>(`/seasons/${year}/${season}?limit=20`);
	return data.data.map((anime) => ({
		id: anime.mal_id,
		title: anime.title,
		image_url: anime.images?.jpg?.image_url ?? '',
		rating: anime.rating,
		episodes: anime.episodes,
		status: anime.status,
		score: anime.score
	}));
}

export async function fetchAnimeByGenre(genreId: number, page = 1): Promise<MiruroAnimeCard[]> {
	const data = await jikanFetch<{ data: any[] }>(`/anime?limit=24&page=${page}&genres=${genreId}`);
	return data.data.map((anime) => ({
		id: anime.mal_id,
		title: anime.title,
		image_url: anime.images?.jpg?.image_url ?? '',
		rating: anime.rating,
		episodes: anime.episodes,
		status: anime.status,
		score: anime.score
	}));
}

export async function fetchRelatedAnime(malId: number): Promise<MiruroAnimeCard[]> {
	try {
		const data = await jikanFetch<{ data: { relation: string; name: string; url: string; type: string; mal_id?: number }[] }>(
			`/anime/${malId}/relations`
		);
		const related = data.data ?? [];
		const relatedIds = related
			.filter((r) => r.mal_id)
			.slice(0, 8)
			.map((r) => r.mal_id!);

		if (relatedIds.length === 0) return [];

		const details = await Promise.all(
			relatedIds.map((id) =>
				jikanFetch<{ data: any }>(`/anime/${id}`).catch(() => null)
			)
		);

		return details
			.filter((d): d is { data: any } => d !== null)
			.map((d) => {
				const anime = d.data;
				return {
					id: anime.mal_id,
					title: anime.title,
					image_url: anime.images?.jpg?.image_url ?? '',
					rating: anime.rating,
					episodes: anime.episodes,
					status: anime.status,
					score: anime.score
				};
			});
	} catch (e) {
		console.warn('[miruro] Failed to fetch related anime:', e);
		return [];
	}
}

export async function fetchRecommendations(malId: number): Promise<MiruroAnimeCard[]> {
	try {
		const data = await jikanFetch<{ data: { mal_id: number; title: string; images: { jpg: { image_url: string } } }[] }>(
			`/anime/${malId}/recommendations`
		);
		return (data.data ?? [])
			.slice(0, 8)
			.map((rec) => ({
				id: rec.mal_id,
				title: rec.title,
				image_url: rec.images?.jpg?.image_url ?? '',
				rating: undefined,
				episodes: undefined,
				status: undefined,
				score: undefined
			}));
	} catch (e) {
		console.warn('[miruro] Failed to fetch recommendations:', e);
		return [];
	}
}

export function mapMiruroToAniwatch(anime: MiruroAnimeCard): any {
	return {
		rank: 0,
		id: anime.id.toString(),
		name: anime.title,
		description: '',
		poster: anime.image_url,
		jname: anime.title,
		episodes: { sub: anime.episodes ?? 0, dub: null },
		type: 'TV',
		otherInfo: []
	};
}

export function mapMiruroInfoToAniwatch(info: MiruroAnimeInfo): any {
	const genres = (info.genres ?? []).map((g) => g.name);
	const studios = (info.studios ?? []).map((s) => s.name);
	const otherInfo = [
		info.status,
		info.type,
		...genres,
		...studios,
		info.rating
	].filter(Boolean) as string[];

	otherInfo.push(`MAL:${info.id}`);

	return {
		id: info.id.toString(),
		name: info.title,
		jname: info.title_japanese ?? info.title,
		poster: info.image_url,
		description: info.synopsis ?? '',
		stats: {
			rating: info.score ? info.score.toFixed(2) : 'N/A',
			quality: 'HD',
			duration: info.duration ?? 'Unknown',
			episodes: { sub: info.episodes ?? 0, dub: null },
			type: info.type ?? 'TV'
		},
		otherInfo,
		seasons: [],
		relatedAnimes: [],
		recommendedAnimes: []
	};
}