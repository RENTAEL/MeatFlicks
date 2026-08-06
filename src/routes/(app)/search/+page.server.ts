import { htmlCacheControl } from '$lib/server/caching';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ url, fetch, locals, setHeaders }) => {
	setHeaders({ 'Cache-Control': htmlCacheControl(locals.user) });
	const q = url.searchParams.get('q')?.trim() ?? '';

	if (q.length < 2) {
		return { ssrQuery: '', ssrItems: [] };
	}

	let items: Array<{
		id: number;
		title: string;
		poster: string | null;
		rating: number;
		year: string;
		mediaType: string;
		href: string;
	}> = [];

	try {
		const res = await fetch(`/api/search?q=${encodeURIComponent(q)}&limit=48`);
		if (res.ok) {
			const data = await res.json();
			items = (data.items ?? []).map((item: any) => ({
				id: item.tmdbId,
				title: item.title,
				poster: item.posterPath || null,
				rating: (item.rating ?? 0) * 2,
				year: item.releaseDate?.split('-')[0] || '—',
				mediaType: item.media_type === 'tv' ? 'tv' : 'movie',
				href: `/${item.media_type === 'tv' ? 'tv' : 'movie'}/${item.tmdbId}`
			}));
		}
	} catch (e) {
		console.error('[Search] SSR search failed:', e);
	}

	return { ssrQuery: q, ssrItems: items };
};
