import { htmlCacheControl } from '$lib/server/caching';
import type { PageServerLoad } from './$types';
import { libraryRepository } from '$lib/server';
import { fromSlug } from '$lib/utils';

export const load: PageServerLoad = async ({ params, locals, setHeaders }) => {
	setHeaders({ 'Cache-Control': htmlCacheControl(locals.user) });
	const { slug } = params;
	const collection = await libraryRepository.findCollectionWithMovies(slug);

	if (!collection) {
		return {
			collectionTitle: fromSlug(slug),
			movies: [],
			hasContent: false
		};
	}

	const { name: collectionTitle, movies } = collection;

	return {
		collectionTitle,
		movies,
		hasContent: movies.length > 0
	};
};
