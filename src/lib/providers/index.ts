export type Provider = {
	id: string;
	name: string;
	icon: string;
	quality: string;
	priority: number;
	useProxy: boolean;
	buildUrl: (params: ProviderParams) => string;
};

export type ProviderParams = {
	tmdbId: number | string;
	type: 'movie' | 'tv';
	season?: number;
	episode?: number;
	imdbId?: string | null;
};

export const PROVIDERS: Provider[] = [
	{
		id: 'smashystream',
		name: 'Smashy',
		icon: '⚡',
		quality: '4K',
		priority: 1,
		useProxy: false,
		buildUrl: (p) =>
			p.type === 'movie'
				? `https://embed.smashystream.com/playere.php?tmdb=${p.tmdbId}`
				: `https://embed.smashystream.com/playere.php?tmdb=${p.tmdbId}&s=${p.season ?? 1}&e=${p.episode ?? 1}`
	},
	{
		id: 'streamsrc',
		name: 'StreamSrc',
		icon: '🎬',
		quality: '1080p',
		priority: 2,
		useProxy: false,
		buildUrl: (p) =>
			p.type === 'movie'
				? `https://streamsrc.cc/watch/movie/${p.tmdbId}`
				: `https://streamsrc.cc/watch/series/${p.tmdbId}`
	},
	{
		id: 'vidlink',
		name: 'VidLink',
		icon: '📡',
		quality: '720p',
		priority: 3,
		useProxy: false,
		buildUrl: (p) => {
			const customParams = 'primaryColor=63b8bc&secondaryColor=a2a2a2&iconColor=eefdec&icons=default&player=default&title=false&poster=true&autoplay=true&nextbutton=false';
			if (p.type === 'tv') {
				return `https://vidlink.pro/tv/${p.tmdbId}/${p.season ?? 1}/${p.episode ?? 1}?${customParams}`;
			}
			return `https://vidlink.pro/movie/${p.tmdbId}?${customParams}`;
		}
	},
	{
		id: 'vidsrc',
		name: 'VidSrc',
		icon: '🎬',
		quality: '1080p',
		priority: 4,
		useProxy: false,
		buildUrl: (p) =>
			p.type === 'movie'
				? `https://vidsrc.to/embed/movie/${p.tmdbId}`
				: `https://vidsrc.to/embed/tv/${p.tmdbId}/${p.season ?? 1}/${p.episode ?? 1}`
	},
	{
		id: '2embed',
		name: '2Embed',
		icon: '🎥',
		quality: '1080p',
		priority: 5,
		useProxy: false,
		buildUrl: (p) => {
			const id = p.imdbId || p.tmdbId;
			return p.type === 'movie'
				? `https://hnembed.cc/embed/movie/${id}`
				: `https://hnembed.cc/embed/tv/${id}/${p.season ?? 1}/${p.episode ?? 1}`;
		}
	},
	{
		id: 'nontongo',
		name: 'NontonGo',
		icon: '🌐',
		quality: '1080p',
		priority: 7,
		useProxy: false,
		buildUrl: (p) =>
			p.type === 'movie'
				? `https://www.NontonGo.win/embed/movie/${p.tmdbId}`
				: `https://www.NontonGo.win/embed/tv/${p.tmdbId}/${p.season ?? 1}/${p.episode ?? 1}`
	}
];

export const SORTED_PROVIDERS = [...PROVIDERS].sort((a, b) => a.priority - b.priority);
