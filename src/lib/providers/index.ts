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
	type: 'movie' | 'tv' | 'anime';
	season?: number;
	episode?: number;
	imdbId?: string | null;
	malId?: number | null;
	subOrDub?: 'sub' | 'dub';
};

export const PROVIDERS: Provider[] = [
	{
		id: 'streamsrc',
		name: 'StreamSrc',
		icon: '🎬',
		quality: '1080p',
		priority: 1,
		useProxy: false,
		buildUrl: (p) =>
			p.type === 'movie'
				? `https://streamsrc.cc/watch/movie/${p.tmdbId}`
				: `https://streamsrc.cc/watch/series/${p.tmdbId}`
	},
	{
		id: 'vidsrc',
		name: 'VidSrc',
		icon: '🎬',
		quality: '1080p',
		priority: 2,
		useProxy: false,
		buildUrl: (p) =>
			p.type === 'movie'
				? `https://vidsrc.to/embed/movie/${p.tmdbId}`
				: `https://vidsrc.to/embed/tv/${p.tmdbId}/${p.season ?? 1}/${p.episode ?? 1}`
	},
	{
		id: 'vidsrccc',
		name: 'VidSrc (alt)',
		icon: '🎬',
		quality: '1080p',
		priority: 3,
		useProxy: false,
		buildUrl: (p) =>
			p.type === 'movie'
				? `https://vidsrc.cc/embed/movie/${p.tmdbId}`
				: `https://vidsrc.cc/embed/tv/${p.tmdbId}/${p.season ?? 1}/${p.episode ?? 1}`
	},
	{
		id: 'vidsrcpro',
		name: 'VidSrc PRO',
		icon: '🎬',
		quality: '4K',
		priority: 4,
		useProxy: false,
		buildUrl: (p) =>
			p.type === 'movie'
				? `https://vidsrc.pro/embed/movie/${p.tmdbId}`
				: `https://vidsrc.pro/embed/tv/${p.tmdbId}/${p.season ?? 1}/${p.episode ?? 1}`
	},
	{
		id: 'vidsrcicu',
		name: 'VidSrc ICU',
		icon: '🎬',
		quality: '1080p',
		priority: 5,
		useProxy: false,
		buildUrl: (p) =>
			p.type === 'movie'
				? `https://vidsrc.icu/embed/movie/${p.tmdbId}`
				: `https://vidsrc.icu/embed/tv/${p.tmdbId}/${p.season ?? 1}/${p.episode ?? 1}`
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
		id: '2embed-skin',
		name: '2Embed.Skin',
		icon: '🎥',
		quality: '1080p',
		priority: 6,
		useProxy: false,
		buildUrl: (p) => {
			const id = p.imdbId || p.tmdbId;
			return p.type === 'movie'
				? `https://2embed.skin/embed/movie/${id}`
				: `https://2embed.skin/embed/tv/${id}/${p.season ?? 1}/${p.episode ?? 1}`;
		}
	},
	{
		id: 'autoembed',
		name: 'AutoEmbed',
		icon: '🔄',
		quality: '1080p',
		priority: 7,
		useProxy: false,
		buildUrl: (p) =>
			p.type === 'anime'
				? `https://player.autoembed.cc/embed/anime/${p.malId ?? p.tmdbId}/${p.episode ?? 1}${p.subOrDub === 'dub' ? '/dub' : ''}`
				: `https://player.autoembed.cc/embed/${p.type === 'movie' ? 'movie' : 'tv'}/${p.tmdbId}${p.type !== 'movie' ? `/${p.season ?? 1}/${p.episode ?? 1}` : ''}`
	},
	{
		id: 'multiembed',
		name: 'MultiEmbed',
		icon: '🔗',
		quality: '1080p',
		priority: 8,
		useProxy: false,
		buildUrl: (p) => {
			const source = p.imdbId ? 'imdb' : 'tmdb';
			const id = p.imdbId ?? String(p.tmdbId);
			return p.type === 'movie'
				? `https://multiembed.mov/movie?${source}=${id}`
				: `https://multiembed.mov/tv?${source}=${id}&s=${p.season ?? 1}&e=${p.episode ?? 1}`;
		}
	},
	{
		id: 'embed-su',
		name: 'Embed.su',
		icon: '▶️',
		quality: '1080p',
		priority: 9,
		useProxy: false,
		buildUrl: (p) =>
			p.type === 'movie'
				? `https://embed.su/embed/movie/${p.tmdbId}`
				: `https://embed.su/embed/tv/${p.tmdbId}/${p.season ?? 1}/${p.episode ?? 1}`
	},
	{
		id: 'smashystream',
		name: 'Smashy',
		icon: '⚡',
		quality: '4K',
		priority: 10,
		useProxy: false,
		buildUrl: (p) =>
			p.type === 'movie'
				? `https://embed.smashystream.com/playere.php?tmdb=${p.tmdbId}`
				: `https://embed.smashystream.com/playere.php?tmdb=${p.tmdbId}&s=${p.season ?? 1}&e=${p.episode ?? 1}`
	},
	{
		id: 'vidlink',
		name: 'VidLink',
		icon: '📡',
		quality: '720p',
		priority: 11,
		useProxy: false,
		buildUrl: (p) => {
			const customParams = 'primaryColor=63b8bc&secondaryColor=a2a2a2&iconColor=eefdec&icons=default&player=default&title=false&poster=true&autoplay=true&nextbutton=false';
			if (p.type === 'anime') {
				return `https://vidlink.pro/anime/${p.malId ?? p.tmdbId}/${p.episode ?? 1}/${p.subOrDub ?? 'sub'}?${customParams}&fallback=true`;
			}
			if (p.type === 'tv') {
				return `https://vidlink.pro/tv/${p.tmdbId}/${p.season ?? 1}/${p.episode ?? 1}?${customParams}`;
			}
			return `https://vidlink.pro/movie/${p.tmdbId}?${customParams}`;
		}
	},
	{
		id: 'nontongo',
		name: 'NontonGo',
		icon: '🌐',
		quality: '1080p',
		priority: 12,
		useProxy: false,
		buildUrl: (p) =>
			p.type === 'movie'
				? `https://www.NontonGo.win/embed/movie/${p.tmdbId}`
				: `https://www.NontonGo.win/embed/tv/${p.tmdbId}/${p.season ?? 1}/${p.episode ?? 1}`
	}
];

export const SORTED_PROVIDERS = [...PROVIDERS].sort((a, b) => a.priority - b.priority);
