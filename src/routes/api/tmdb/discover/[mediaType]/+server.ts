import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { env } from '$lib/config/env';
import { isEligibleMedia, todayParam } from '$lib/utils/mediaFilter';

const VALID_TYPES = new Set(['movie', 'tv']);

export const GET: RequestHandler = async ({ params, url }) => {
  const mediaType = params.mediaType;
  if (!VALID_TYPES.has(mediaType)) {
    return json({ error: `Invalid media type: ${mediaType}`, results: [], total_pages: 0 }, { status: 400 });
  }

  const page = url.searchParams.get('page') || '1';
  const sortBy = url.searchParams.get('sort_by') || 'popularity.desc';
  const voteCountGte = url.searchParams.get('vote_count.gte') || '50';
  const withGenres = url.searchParams.get('with_genres') || '';

  let tmdbUrl = `https://api.themoviedb.org/3/discover/${mediaType}?api_key=${env.TMDB_API_KEY}&language=en-US&sort_by=${sortBy}&include_adult=false&include_video=false&page=${page}&vote_count.gte=${voteCountGte}&${mediaType === 'tv' ? 'first_air_date' : 'primary_release_date'}.lte=${todayParam()}`;
  if (withGenres) tmdbUrl += `&with_genres=${withGenres}`;

  try {
    const res = await fetch(tmdbUrl, { signal: AbortSignal.timeout(8000) });
    const data = await res.json();

    if (!res.ok) {
      return json({ error: data.status_message || 'TMDB API error', results: [], total_pages: 0 }, { status: res.status });
    }

    return json({
      results: (data.results ?? []).filter(isEligibleMedia),
      total_pages: data.total_pages ?? 1,
      page: data.page ?? 1
    });
  } catch (e: any) {
    return json({ error: e.message || 'Failed to fetch movies', results: [], total_pages: 0 }, { status: 500 });
  }
};
