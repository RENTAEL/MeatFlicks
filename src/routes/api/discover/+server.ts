import { json } from '@sveltejs/kit';
import { FEATURES } from '$lib/config/features';
import { env } from '$lib/config/env';

export async function GET({ url }) {
  if (!FEATURES.DISCOVERY_ENGINE) {
    return json({ results: [], feature: 'disabled' });
  }

  const mood = url.searchParams.get('mood') || 'popular';

  try {
    const genreMap: Record<string, number> = {
      'Action': 28,
      'Comedy': 35,
      'Horror': 27,
      'Romance': 10749,
      'Sci-Fi': 878,
      'Thriller': 53,
      'Drama': 18,
      'Mystery': 9648,
    };

    const genreId = genreMap[mood];
    const tmdbKey = env.TMDB_API_KEY;

    if (!tmdbKey) {
      console.warn('[Discover API] No TMDB key configured');
      return json([]);
    }

    const endpoint = genreId
      ? `https://api.themoviedb.org/3/discover/movie?api_key=${tmdbKey}&with_genres=${genreId}&sort_by=vote_average.desc&vote_count.gte=200`
      : `https://api.themoviedb.org/3/movie/popular?api_key=${tmdbKey}`;

    const res = await fetch(endpoint);
    if (!res.ok) throw new Error(`TMDB returned ${res.status}`);

    const data = await res.json();
    return json(
      (data.results || []).slice(0, 12).map((m: any) => ({
        id: m.id,
        title: m.title,
        poster: m.poster_path
          ? `https://image.tmdb.org/t/p/w342${m.poster_path}`
          : '/placeholder-poster.svg',
        rating: m.vote_average?.toFixed(1),
        year: m.release_date?.split('-')[0],
      }))
    );
  } catch (e) {
    console.error('[Discover API] Failed:', e);
    return json([]);
  }
}
