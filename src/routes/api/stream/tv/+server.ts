import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { env } from '$lib/config/env';
import { isEligibleMedia } from '$lib/utils/mediaFilter';

const TMDB_BASE = 'https://api.themoviedb.org/3';

export const GET: RequestHandler = async ({ url, fetch }) => {
  const query = url.searchParams.get('q') || '';
  const page = url.searchParams.get('page') || '1';

  let endpoint: string;
  let params: URLSearchParams;

  if (query) {
    endpoint = `${TMDB_BASE}/search/tv`;
    params = new URLSearchParams({
      query,
      page,
      language: 'en-US',
    });
  } else {
    endpoint = `${TMDB_BASE}/tv/popular`;
    params = new URLSearchParams({
      page,
      language: 'en-US',
    });
  }

  params.set('api_key', env.TMDB_API_KEY);

  try {
    const res = await fetch(`${endpoint}?${params}`, {
      signal: AbortSignal.timeout(8000),
    });

    if (!res.ok) {
      return json({ results: [], page: 1, total_pages: 1, total_results: 0, error: `TMDB returned ${res.status}` }, { status: res.status });
    }

    const data = await res.json();

    return json({
      results: (data.results ?? []).filter(isEligibleMedia),
      page: data.page ?? 1,
      total_pages: data.total_pages ?? 1,
      total_results: data.total_results ?? 0,
    });
  } catch (e: any) {
    return json({ results: [], page: 1, total_pages: 1, total_results: 0, error: e.message }, { status: 500 });
  }
};
