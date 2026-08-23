/**
 * Source-chain definition for the isolated Afrikaans player. Pure data so
 * both the server (reachability probe) and the client (URL building) can
 * share it without pulling Svelte code into the server path.
 */
export interface AfSource {
	id: string;
	label: string;
	host: string;
	reportsEvents: boolean;
	url: (kind: 'movie' | 'tv', id: number, s: number, e: number) => string;
}

export const AFRIKAANS_SOURCES: AfSource[] = [
	{
		id: 'vidlink',
		label: 'VidLink',
		host: 'vidlink.pro',
		reportsEvents: true,
		url: (k, id, s, e) =>
			k === 'movie'
				? `https://vidlink.pro/movie/${id}?autoplay=true&title=false&poster=true`
				: `https://vidlink.pro/tv/${id}/${s}/${e}?autoplay=true&title=false&poster=true`
	},
	{
		id: 'vidsrc-to',
		label: 'VidSrc',
		host: 'vidsrc.to',
		reportsEvents: false,
		url: (k, id, s, e) =>
			k === 'movie'
				? `https://vidsrc.to/embed/movie/${id}`
				: `https://vidsrc.to/embed/tv/${id}/${s}/${e}`
	},
	{
		id: 'vidsrc-xyz',
		label: 'VidSrc XYZ',
		host: 'vidsrc.xyz',
		reportsEvents: false,
		url: (k, id, s, e) =>
			k === 'movie'
				? `https://vidsrc.xyz/embed/movie/${id}`
				: `https://vidsrc.xyz/embed/tv/${id}/${s}/${e}`
	},
	{
		id: '2embed',
		label: '2Embed',
		host: '2embed.cc',
		reportsEvents: false,
		url: (k, id, s, e) =>
			k === 'movie'
				? `https://www.2embed.cc/embed/${id}`
				: `https://www.2embed.cc/embedtv/${id}&s=${s}&e=${e}`
	},
	{
		id: 'vidsrc-pm',
		label: 'VidSrc PM',
		host: 'vidsrc.pm',
		reportsEvents: false,
		url: (k, id, s, e) =>
			k === 'movie'
				? `https://vidsrc.pm/embed/movie/${id}`
				: `https://vidsrc.pm/embed/tv/${id}/${s}/${e}`
	}
];
