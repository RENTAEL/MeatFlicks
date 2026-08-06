import { htmlCacheControl } from '$lib/server/caching';
import type { PageServerLoad } from './$types';
import { libraryRepository } from '$lib/server';

export const load: PageServerLoad = async ({ locals, setHeaders }) => {
	setHeaders({ 'Cache-Control': htmlCacheControl(locals.user) });
	const genres = await libraryRepository.listGenres();

	return {
		categories: [
			{ title: 'Movies', slug: 'movies', description: 'Discover feature films across all genres' },
			{
				title: 'TV Shows',
				slug: 'tv-shows',
				description: 'Explore the latest and classic television series'
			}
		],
		topGenres: genres.slice(0, 12).map((g: { id: number; name: string }) => ({
			name: g.name,
			slug: g.name.toLowerCase().replace(/\s+/g, '-')
		}))
	};
};
