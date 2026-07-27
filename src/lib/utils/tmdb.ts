export const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p';

export function formatMovie(m: any) {
	return {
		id: m.id,
		title: m.title || m.name,
		poster: m.poster_path ? `${TMDB_IMAGE_BASE}/w342${m.poster_path}` : null,
		backdrop: m.backdrop_path ? `${TMDB_IMAGE_BASE}/w1280${m.backdrop_path}` : null,
		rating: m.vote_average,
		year: (m.release_date || m.first_air_date)?.split('-')[0] || '—',
		overview: m.overview,
		mediaType: m.media_type || 'movie'
	};
}


