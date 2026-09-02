export const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p';

/** TMDB genre id → display name (movie + tv ids are unique). */
export const TMDB_GENRE_NAMES: Record<number, string> = {
	28: 'Action',
	12: 'Adventure',
	16: 'Animation',
	35: 'Comedy',
	80: 'Crime',
	99: 'Documentary',
	18: 'Drama',
	10751: 'Family',
	14: 'Fantasy',
	36: 'History',
	27: 'Horror',
	10402: 'Music',
	9648: 'Mystery',
	10749: 'Romance',
	878: 'Sci-Fi',
	10770: 'TV Movie',
	53: 'Thriller',
	10752: 'War',
	37: 'Western',
	10759: 'Action & Adventure',
	10762: 'Kids',
	10763: 'News',
	10764: 'Reality',
	10765: 'Sci-Fi & Fantasy',
	10766: 'Soap',
	10767: 'Talk',
	10768: 'War & Politics'
};

export function formatMovie(m: any) {
	return {
		id: m.id,
		title: m.title || m.name,
		poster: m.poster_path ? `${TMDB_IMAGE_BASE}/w342${m.poster_path}` : null,
		backdrop: m.backdrop_path ? `${TMDB_IMAGE_BASE}/w1280${m.backdrop_path}` : null,
		rating: m.vote_average || 0,
		release_date: m.release_date || m.first_air_date || null,
		year: (m.release_date || m.first_air_date)?.split('-')[0] || '—',
		overview: m.overview,
		mediaType: m.media_type || 'movie'
	};
}

export function formatMedia(m: any) {
	return formatMovie(m);
}

export function toLibraryMovie(m: any) {
	if (!m) return null;
	const year = typeof m.year === 'string' && /^\d{4}$/.test(m.year) ? m.year : null;
	const releaseDate = m.releaseDate ?? m.release_date ?? m.first_air_date ?? (year ? `${year}-01-01` : null);
	const mediaType = m.mediaType || m.media_type || 'movie';
	return {
		id: String(m.id ?? m.tmdbId ?? m.title ?? 'untitled'),
		tmdbId: m.tmdbId ?? m.id ?? null,
		title: m.title || m.name || 'Untitled',
		overview: m.overview ?? null,
		posterPath: m.posterPath ?? m.poster ?? m.poster_path ?? null,
		backdropPath: m.backdropPath ?? m.backdrop ?? m.backdrop_path ?? null,
		releaseDate,
		rating: typeof m.rating === 'number' ? m.rating : (m.vote_average ?? null),
		durationMinutes: m.runtime ?? m.durationMinutes ?? null,
		is4K: Boolean(m.is4K),
		isHD: m.isHD ?? true,
		mediaType,
		media_type: mediaType,
		genres: Array.isArray(m.genres) && m.genres.length > 0
			? m.genres
			: Array.isArray(m.genre_ids)
				? m.genre_ids.map((id: number) => TMDB_GENRE_NAMES[id]).filter(Boolean)
				: [],
		imdbId: m.imdbId ?? m.imdb_id ?? null,
		trailerUrl: m.trailerUrl ?? null,
		canonicalPath: m.canonicalPath ?? null,
		addedAt: m.addedAt ?? null
	};
}


