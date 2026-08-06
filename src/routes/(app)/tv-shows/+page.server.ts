import { htmlCacheControl } from '$lib/server/caching';
import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, setHeaders }) => {
	setHeaders({ 'Cache-Control': htmlCacheControl(locals.user) });
	redirect(302, '/tv');
};
