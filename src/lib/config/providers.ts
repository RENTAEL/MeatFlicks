export interface MovieProvider {
	name: string;
	buildUrl: (id: number) => string;
}

export interface TvProvider {
	name: string;
	buildUrl: (id: number, season: number, episode: number) => string;
}

const MOVIE_PROVIDERS_LIST: MovieProvider[] = [
	{
		name: 'autoembed.co',
		buildUrl: (id: number) =>
			`https://player.autoembed.co/embed/movie/${id}`
	},
	{
		name: 'vidlink.pro',
		buildUrl: (id: number) =>
			`https://vidlink.pro/movie/${id}?autoplay=true`
	},
	{
		name: 'vidsrc.to',
		buildUrl: (id: number) =>
			`https://vidsrc.to/embed/movie/${id}`
	}
];

const TV_PROVIDERS_LIST: TvProvider[] = [
	{
		name: 'autoembed.co',
		buildUrl: (id: number, season: number, episode: number) =>
			`https://player.autoembed.co/embed/tv/${id}/${season}/${episode}`
	},
	{
		name: 'vidlink.pro',
		buildUrl: (id: number, season: number, episode: number) =>
			`https://vidlink.pro/tv/${id}/${season}/${episode}?autoplay=true`
	},
	{
		name: 'vidsrc.to',
		buildUrl: (id: number, season: number, episode: number) =>
			`https://vidsrc.to/embed/tv/${id}/${season}/${episode}`
	}
];

export const MOVIE_PROVIDERS = MOVIE_PROVIDERS_LIST;
export const TV_PROVIDERS = TV_PROVIDERS_LIST;
