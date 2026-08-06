import { htmlCacheControl } from '$lib/server/caching';
import type { PageServerLoad } from './$types';
import { libraryService } from '$lib/server';
import { fetchAfrikaansRail } from '$lib/server/afrikaans';

export const load: PageServerLoad = async ({ locals, setHeaders }) => {
	setHeaders({ 'Cache-Control': htmlCacheControl(locals.user) });
	const homeLibraryPromise = libraryService.fetchHomeLibrary();

	return {
		streamed: {
			homeLibrary: homeLibraryPromise,
			afrikaans: fetchAfrikaansRail('gewild')
		}
	};
};
