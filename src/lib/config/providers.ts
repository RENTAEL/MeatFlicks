export interface MovieProvider {
	name: string;
	buildUrl: (id: number) => string;
}

export interface TvProvider {
	name: string;
	buildUrl: (id: number, season: number, episode: number) => string;
}

export const MOVIE_PROVIDERS: MovieProvider[] = [
	{
		name: 'vidlink.pro',
		buildUrl: (id: number) => `https://vidlink.pro/movie/${id}?autoplay=true&title=false&poster=true&nextbutton=false`
	},
	{
		name: 'vidsrcme.su',
		buildUrl: (id: number) => `https://vidsrcme.su/embed/movie/${id}`
	},
	{
		name: 'vidsrc.to',
		buildUrl: (id: number) => `https://vidsrc.to/embed/movie/${id}`
	},
	{
		name: 'vidbinge.dev',
		buildUrl: (id: number) => `https://vidbinge.dev/embed/movie/${id}`
	},
	{
		name: 'superembed.stream',
		buildUrl: (id: number) => `https://superembed.stream/embed/movie/${id}`
	},
	{
		name: 'embed.su',
		buildUrl: (id: number) => `https://embed.su/embed/movie/${id}`
	},
	{
		name: 'autoembed.co',
		buildUrl: (id: number) => `https://autoembed.co/movie/${id}`
	},
	{
		name: 'smashystream.xyz',
		buildUrl: (id: number) => `https://smashystream.xyz/movie/${id}`
	},
	{
		name: 'rivestream.lol',
		buildUrl: (id: number) => `https://rivestream.lol/embed/movie/${id}`
	},
	{
		name: 'moviee.tv',
		buildUrl: (id: number) => `https://moviee.tv/embed/movie/${id}`
	},
	{
		name: 'nontongo.win',
		buildUrl: (id: number) => `https://nontongo.win/embed/movie/${id}`
	},
	{
		name: '111movies.com',
		buildUrl: (id: number) => `https://111movies.com/embed/movie/${id}`
	}
];

export const TV_PROVIDERS: TvProvider[] = [
	{
		name: 'vidlink.pro',
		buildUrl: (id: number, season: number, episode: number) =>
			`https://vidlink.pro/tv/${id}/${season}/${episode}?autoplay=true&title=false&poster=true&nextbutton=false`
	},
	{
		name: 'vidsrcme.su',
		buildUrl: (id: number, season: number, episode: number) =>
			`https://vidsrcme.su/embed/tv/${id}/${season}/${episode}`
	},
	{
		name: 'vidsrc.to',
		buildUrl: (id: number, season: number, episode: number) =>
			`https://vidsrc.to/embed/tv/${id}/${season}/${episode}`
	},
	{
		name: 'vidbinge.dev',
		buildUrl: (id: number, season: number, episode: number) =>
			`https://vidbinge.dev/embed/tv/${id}/${season}/${episode}`
	},
	{
		name: 'superembed.stream',
		buildUrl: (id: number, season: number, episode: number) =>
			`https://superembed.stream/embed/tv/${id}/${season}/${episode}`
	},
	{
		name: 'embed.su',
		buildUrl: (id: number, season: number, episode: number) =>
			`https://embed.su/embed/tv/${id}/${season}/${episode}`
	},
	{
		name: 'autoembed.co',
		buildUrl: (id: number, season: number, episode: number) =>
			`https://autoembed.co/tv/${id}/${season}/${episode}`
	},
	{
		name: 'smashystream.xyz',
		buildUrl: (id: number, season: number, episode: number) =>
			`https://smashystream.xyz/tv/${id}/${season}/${episode}`
	},
	{
		name: 'rivestream.lol',
		buildUrl: (id: number, season: number, episode: number) =>
			`https://rivestream.lol/embed/tv/${id}/${season}/${episode}`
	},
	{
		name: 'moviee.tv',
		buildUrl: (id: number, season: number, episode: number) =>
			`https://moviee.tv/embed/tv/${id}/${season}/${episode}`
	}
];
