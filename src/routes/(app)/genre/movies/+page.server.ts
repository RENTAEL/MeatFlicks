import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ url }) => {
  const genreId = url.searchParams.get('genreId') || '';
  const page = url.searchParams.get('page') || '1';

  let genres: Array<{ id: number; name: string }> = [];
  let movies: Array<any> = [];
  let totalPages = 1;
  let fetchError = '';
  let activeGenreId = genreId;

  try {
    const { api } = await import('$lib/server/services/tmdb.client');
    const genreData = await api('/genre/movie/list', {
      query: { language: 'en-US' }
    }) as { genres: Array<{ id: number; name: string }> };
    genres = genreData.genres || [];

    if (genreId) {
      const discoverData = await api(`/discover/movie`, {
        query: {
          language: 'en-US',
          sort_by: 'popularity.desc',
          page,
          with_genres: genreId,
          vote_count: '50'
        }
      }) as { results: Array<any>; total_pages: number };
      movies = (discoverData.results || []).map((item: any) => ({
        id: String(item.id),
        tmdbId: item.id,
        title: item.title || item.name || 'Untitled',
        overview: item.overview || null,
        posterPath: item.poster_path || null,
        backdropPath: item.backdrop_path || null,
        releaseDate: item.release_date || null,
        rating: item.vote_average || null,
        durationMinutes: null,
        is4K: false,
        isHD: true,
        mediaType: 'movie',
        media_type: 'movie',
        genres: [],
        imdbId: null,
        trailerUrl: null
      }));
      totalPages = Math.min(discoverData.total_pages ?? 1, 500);
    }
  } catch (e: any) {
    fetchError = e?.message || 'Failed to fetch from TMDB';
    console.error('[genre/movies] TMDB fetch failed:', fetchError);
  }

  return { genres, movies, totalPages, fetchError, activeGenreId };
};
