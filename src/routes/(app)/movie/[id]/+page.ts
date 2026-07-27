import { PUBLIC_TMDB_API_KEY } from '$env/static/public';

const TMDB_BASE = 'https://api.themoviedb.org/3';

export async function load({ params, fetch }) {
	const { id } = params;

	try {
		const [movieRes, creditsRes, similarRes] = await Promise.all([
			fetch(`${TMDB_BASE}/movie/${id}?append_to_response=videos&api_key=${PUBLIC_TMDB_API_KEY}`),
			fetch(`${TMDB_BASE}/movie/${id}/credits?api_key=${PUBLIC_TMDB_API_KEY}`),
			fetch(`${TMDB_BASE}/movie/${id}/similar?api_key=${PUBLIC_TMDB_API_KEY}`)
		]);

		const [movie, credits, similar] = await Promise.all([
			movieRes.json(),
			creditsRes.json(),
			similarRes.json()
		]);

		const director = credits.crew?.find((person: any) => person.job === 'Director')?.name;
		const cast = credits.cast?.slice(0, 10).map((person: any) => person.name) || [];

		return {
			movie: {
				id: movie.id,
				title: movie.title,
				tagline: movie.tagline,
				overview: movie.overview,
				release_date: movie.release_date,
				runtime: movie.runtime,
				vote_average: movie.vote_average,
				genres: movie.genres || [],
				poster_path: movie.poster_path,
				backdrop_path: movie.backdrop_path,
				director,
				cast,
				budget: movie.budget,
				revenue: movie.revenue
			},
			similarMovies: (similar.results || []).slice(0, 12).map((m: any) => ({
				id: m.id,
				title: m.title,
				poster: m.poster_path ? `https://image.tmdb.org/t/p/w342${m.poster_path}` : null,
				rating: m.vote_average,
				year: m.release_date ? new Date(m.release_date).getFullYear() : '—'
			}))
		};
	} catch (e) {
		return {
			movie: null,
			similarMovies: [],
			error: 'Failed to load movie data'
		};
	}
}
