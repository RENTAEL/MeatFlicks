const TMDB_BASE = 'https://api.themoviedb.org/3';

export interface TMDbMovie {
	id: number;
	title: string;
	overview: string;
	poster_path: string | null;
	backdrop_path: string | null;
	release_date: string;
	vote_average: number;
	genres: { id: number; name: string }[];
	runtime: number;
	tagline: string;
	credits: {
		cast: { id: number; name: string; character: string }[];
		crew: { id: number; name: string; job: string }[];
	};
	videos: {
		results: { key: string; type: string; site: string }[];
	};
}

export async function getMovieInAfrikaans(id: number): Promise<TMDbMovie | null> {
	try {
		const res = await fetch(
			`${TMDB_BASE}/movie/${id}?api_key=${process.env.TMDB_API_KEY}` +
			`&language=af` +
			`&append_to_response=credits,videos`
		);

		if (!res.ok) return null;

		return await res.json();
	} catch {
		return null;
	}
}

export async function discoverAfrikaansMovies(page = 1): Promise<{
	results: TMDbMovie[];
	total_pages: number;
	total_results: number;
}> {
	const res = await fetch(
		`${TMDB_BASE}/discover/movie?api_key=${process.env.TMDB_API_KEY}` +
		`&language=af` +
		`&with_original_language=af` +
		`&sort_by=popularity.desc` +
		`&page=${page}` +
		`&region=ZA`
	);

	return res.json();
}

export async function discoverSouthAfricanMovies(page = 1) {
	const res = await fetch(
		`${TMDB_BASE}/discover/movie?api_key=${process.env.TMDB_API_KEY}` +
		`&language=af` +
		`&with_origin_country=ZA` +
		`&sort_by=popularity.desc` +
		`&page=${page}`
	);

	return res.json();
}
