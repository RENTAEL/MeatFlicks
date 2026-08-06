import { json } from '@sveltejs/kit';
import {
	fetchAfrikaansBrowse,
	parseAfrikaansBrowseParams
} from '$lib/server/afrikaans';

export async function GET({ url }) {
	const page = Math.max(1, Number(url.searchParams.get('page')) || 1);
	const params = parseAfrikaansBrowseParams(url.searchParams);

	const data = await fetchAfrikaansBrowse({ type: params.type, page, genre: params.genre, decade: params.decade, sort: params.sort });

	return json(data, {
		headers: { 'Cache-Control': 'public, max-age=120, s-maxage=300, stale-while-revalidate=300' }
	});
}
