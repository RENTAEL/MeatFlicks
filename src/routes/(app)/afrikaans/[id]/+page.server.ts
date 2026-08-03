import { AFRIKAANS_FILMS } from '$lib/curated/afrikaans-films';
import { env } from '$lib/config/env';

const TMDB_BASE = 'https://api.themoviedb.org/3';
const LANG = 'af';

async function findYoutubeSource(title: string, year?: string): Promise<string | null> {
	try {
		const yearStr = year ? ` ${year}` : '';
		const query = encodeURIComponent(`${title}${yearStr} volledige film`);
		const url = `https://www.youtube.com/results?search_query=${query}`;

		const res = await fetch(url, {
			headers: {
				'Accept-Language': 'af,en',
				'User-Agent': 'Mozilla/5.0 (compatible; Streamium/1.0)',
			},
		});

		if (!res.ok) return null;

		const html = await res.text();

		const match = html.match(/\/watch\?v=([a-zA-Z0-9_-]{11})/);
		if (match) {
			return `https://www.youtube.com/embed/${match[1]}?autoplay=1&rel=0`;
		}

		const jsonMatch = html.match(/var ytInitialData\s*=\s*({.*?});/);
		if (jsonMatch) {
			const data = JSON.parse(jsonMatch[1]);
			const contents = data?.contents?.twoColumnSearchResultsRenderer
				?.primaryContents?.sectionListRenderer?.contents?.[0]
				?.itemSectionRenderer?.contents;

			if (contents) {
				for (const item of contents) {
					const videoId = item?.videoRenderer?.videoId;
					if (videoId) {
						return `https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0`;
					}
				}
			}
		}

		return null;
	} catch {
		return null;
	}
}

export async function load({ params, fetch }) {
	const { id } = params;

	try {
		const [movieRes, creditsRes, similarRes] = await Promise.all([
			fetch(`${TMDB_BASE}/movie/${id}?append_to_response=videos&api_key=${env.TMDB_API_KEY}&language=${LANG}`),
			fetch(`${TMDB_BASE}/movie/${id}/credits?api_key=${env.TMDB_API_KEY}`),
			fetch(`${TMDB_BASE}/movie/${id}/similar?api_key=${env.TMDB_API_KEY}&language=${LANG}`)
		]);

		const [movie, credits, similar] = await Promise.all([
			movieRes.json(),
			creditsRes.json(),
			similarRes.json()
		]);

		const director = credits.crew?.find((person: any) => person.job === 'Director')?.name;
		const cast = credits.cast?.slice(0, 10).map((person: any) => person.name) || [];

		const curated = AFRIKAANS_FILMS.find((f) => f.tmdbId === Number(id));

		const title = movie.title;
		const year = movie.release_date?.slice(0, 4);
		const preResolvedSource = await findYoutubeSource(title, year);

		return {
			movie: {
				id: movie.id,
				title,
				titleEn: curated?.titleEn || null,
				tagline: movie.tagline,
				overview: movie.overview,
				release_date: movie.release_date,
				runtime: movie.runtime,
				vote_average: movie.vote_average,
				genres: movie.genres || [],
				poster_path: movie.poster_path,
				backdrop_path: movie.backdrop_path,
				director: curated?.director || director,
				cast,
				budget: movie.budget,
				revenue: movie.revenue
			},
			preResolvedSource,
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
			preResolvedSource: null,
			similarMovies: [],
			error: 'Kon nie filmdata laai nie'
		};
	}
}
