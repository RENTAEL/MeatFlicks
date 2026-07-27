import { PUBLIC_TMDB_API_KEY } from '$env/static/public';

const TMDB_BASE = 'https://api.themoviedb.org/3';

export async function load({ params, url, fetch }) {
	const { id } = params;
	const season = parseInt(url.searchParams.get('s') || '1');
	const episode = parseInt(url.searchParams.get('e') || '1');

	try {
		const [showRes, seasonRes, similarRes] = await Promise.all([
			fetch(`${TMDB_BASE}/tv/${id}?append_to_response=credits,external_ids&api_key=${PUBLIC_TMDB_API_KEY}`),
			fetch(`${TMDB_BASE}/tv/${id}/season/${season}?api_key=${PUBLIC_TMDB_API_KEY}`),
			fetch(`${TMDB_BASE}/tv/${id}/similar?api_key=${PUBLIC_TMDB_API_KEY}`)
		]);

		const [show, seasonData, similar] = await Promise.all([
			showRes.json(),
			seasonRes.json(),
			similarRes.json()
		]);

		const seasons = (show.seasons || [])
			.filter((s: any) => s.season_number > 0)
			.map((s: any) => ({
				season_number: s.season_number,
				episode_count: s.episode_count,
				name: s.name || `Season ${s.season_number}`
			}));

		const episodes = (seasonData.episodes || []).map((ep: any) => ({
			episode_number: ep.episode_number,
			name: ep.name,
			overview: ep.overview,
			still_path: ep.still_path,
			runtime: ep.runtime,
			air_date: ep.air_date
		}));

		return {
			show: {
				id: show.id,
				name: show.name,
				tagline: show.tagline,
				overview: show.overview,
				first_air_date: show.first_air_date,
				last_air_date: show.last_air_date,
				vote_average: show.vote_average,
				number_of_seasons: show.number_of_seasons,
				number_of_episodes: show.number_of_episodes,
				status: show.status,
				genres: show.genres || [],
				networks: show.networks,
				created_by: show.created_by,
				poster_path: show.poster_path,
				backdrop_path: show.backdrop_path
			},
			seasons,
			episodes,
			currentSeason: season,
			currentEpisode: episode,
			similarShows: (similar.results || []).slice(0, 12).map((s: any) => ({
				id: s.id,
				title: s.name,
				poster: s.poster_path ? `https://image.tmdb.org/t/p/w342${s.poster_path}` : null,
				rating: s.vote_average || 0,
				year: s.first_air_date?.split('-')[0] || '—'
			}))
		};
	} catch {
		return {
			show: null,
			seasons: [],
			episodes: [],
			currentSeason: 1,
			currentEpisode: 1,
			similarShows: [],
			error: 'Failed to load TV show data'
		};
	}
}
