const BASE_URL = 'https://api-anime-rouge.vercel.app';

async function animeFetch<T>(path: string): Promise<T> {
	const url = `${BASE_URL}${path}`;
	const response = await fetch(url, {
		headers: { 'User-Agent': 'Streamium/1.0' },
		signal: AbortSignal.timeout(15000)
	});
	if (!response.ok) throw new Error(`Anime API ${response.status}: ${response.statusText}`);
	return response.json() as Promise<T>;
}

export type AniwatchHome = {
	spotLightAnimes: SpotlightAnime[];
	trendingAnimes: TrendCard[];
	latestEpisodes: LatestEpisode[];
	top10Animes: { day: TrendCard[]; week: TrendCard[]; month: TrendCard[] };
	genres: string[];
};

export type SpotlightAnime = {
	rank: number;
	id: string;
	name: string;
	description: string;
	poster: string;
	jname: string;
	episodes: { sub: number; dub: number | null };
	type: string;
	otherInfo: string[];
};

export type TrendCard = {
	rank: number;
	id: string;
	name: string;
	poster: string;
	jname: string;
	episodes: { sub: number; dub: number | null };
	type: string;
};

export type LatestEpisode = {
	id: string;
	name: string;
	jname: string;
	poster: string;
	episode: { sub: number; dub: number | null };
	type: string;
};

export type Top10Section = {
	category: 'today' | 'week' | 'month';
	animes: TrendCard[];
};

export type AnimeInfo = {
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
	seasons: { id: string; name: string; title: string; poster: string; isCurrent: boolean }[];
	relatedAnimes: { id: string; name: string; poster: string; jname: string; episodes: { sub: number; dub: number | null }; type: string }[];
	recommendedAnimes: { id: string; name: string; poster: string; jname: string; episodes: { sub: number; dub: number | null }; type: string }[];
};

export type AnimeEpisode = {
	title: string;
	episodeId: string;
	number: number;
	isFiller: boolean;
};

export type AnimeEpisodesResponse = {
	episodes: AnimeEpisode[];
	totalEpisodes: number;
};

export type EpisodeSource = {
	sources: { url: string; quality: string; isM3U8: boolean }[];
	subtitles: { file: string; lang: string; label: string }[];
	intro: { start: number; end: number };
};

export async function fetchAniwatchHome(): Promise<AniwatchHome> {
	return animeFetch<AniwatchHome>('/aniwatch/');
}

export async function searchAnime(keyword: string, page = 1) {
	return animeFetch<any>(`/aniwatch/search?keyword=${encodeURIComponent(keyword)}&page=${page}`);
}

export async function fetchAnimeInfo(animeId: string): Promise<AnimeInfo> {
	return animeFetch<AnimeInfo>(`/aniwatch/anime/${animeId}`);
}

export async function fetchAnimeEpisodes(animeId: string): Promise<AnimeEpisodesResponse> {
	return animeFetch<AnimeEpisodesResponse>(`/aniwatch/episodes/${animeId}`);
}

export async function fetchEpisodeSources(episodeId: string, server = 'hd-1', category: 'sub' | 'dub' = 'sub'): Promise<EpisodeSource> {
	return animeFetch<EpisodeSource>(`/aniwatch/episode-srcs?id=${episodeId}&server=${server}&category=${category}`);
}

export async function browseAnimeCategory(category: string, page = 1) {
	return animeFetch<any>(`/aniwatch/${category}?page=${page}`);
}
