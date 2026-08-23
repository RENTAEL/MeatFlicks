import { redirect } from '@sveltejs/kit';
import { env } from '$lib/config/env';
import { AFRIKAANS_SOURCES } from '$lib/components/afrikaans/sources';
import { AFRIKAANS_FILM_MAP } from '$lib/curated/afrikaans-films';

const TMDB_BASE = 'https://api.themoviedb.org/3';
const UA = { 'User-Agent': 'MeatFlicks/1.0' };

type AfrikaansWatchDetails = {
	tmdbId: number;
	mediaType: 'movie' | 'tv';
	title: string;
	year: string | null;
	overview: string | null;
	backdropPath: string | null;
	posterPath: string | null;
	trailerKey: string | null;
	youtubeIds: string[];
};

async function fetchJson(url: string): Promise<any | null> {
	try {
		const res = await fetch(url, { headers: UA, signal: AbortSignal.timeout(6000) });
		if (!res.ok) return null;
		return await res.json();
	} catch {
		return null;
	}
}

/** All official YouTube video keys for a title — trailers, teasers, clips. */
function collectYoutubeKeys(videos: any): string[] {
	const results = Array.isArray(videos?.results) ? videos.results : [];
	const yt = results.filter((v: any) => v.site === 'YouTube' && v.key);
	const rank = (v: any) =>
		(v.type === 'Trailer' ? 0 : v.type === 'Teaser' ? 1 : 2) + (v.official ? 0 : 0.5);
	return [...yt].sort((a, b) => rank(a) - rank(b)).map((v: any) => v.key as string);
}

/**
 * Probe every embed host once per page load so the player can skip offline
 * sources automatically instead of making the user sit through dead frames.
 * Server-side GET, 4s cap each, all in parallel. Only hard failures count
 * as offline — these hosts commonly answer datacenter requests with 403
 * while serving real users fine.
 */
async function probeSources(
	kind: 'movie' | 'tv',
	id: number,
	s: number,
	e: number
): Promise<Record<string, boolean>> {
	const entries = await Promise.all(
		AFRIKAANS_SOURCES.map(async (src) => {
			try {
				const res = await fetch(src.url(kind, id, s, e), {
					signal: AbortSignal.timeout(4000),
					redirect: 'follow'
				});
				return [src.id, res.status < 500];
			} catch {
				return [src.id, false];
			}
		})
	);
	return Object.fromEntries(entries);
}

/**
 * Dedicated watch page for the Afrikaans section. Completely separate from
 * the main /movie and /tv players — this route resolves its own details and
 * hands them to the isolated AfrikaansPlayer with multi-source fallback.
 */
export async function load({ params, url }) {
	const { id } = params;
	if (!/^\d+$/.test(id)) throw redirect(301, '/afrikaans');

	let mediaType: 'movie' | 'tv' = url.searchParams.get('type') === 'tv' ? 'tv' : 'movie';
	// Curated YouTube IDs always lead the playback chain.
	const curated = AFRIKAANS_FILM_MAP.get(Number(id));
	const curatedIds: string[] = [
		...(curated?.youtubeIds ?? []),
		...(curated?.youtubeId ? [curated.youtubeId] : [])
	];

	let details: AfrikaansWatchDetails = {
		tmdbId: Number(id),
		mediaType,
		title: curated?.title ?? 'Afrikaans Film',
		year: null,
		overview: null,
		backdropPath: null,
		posterPath: null,
		trailerKey: null,
		youtubeIds: [...new Set(curatedIds)]
	};

	const apiKey = env.TMDB_API_KEY;

	if (url.searchParams.get('type') !== 'tv') {
		const movie = await fetchJson(`${TMDB_BASE}/movie/${id}?api_key=${apiKey}`);
		if (movie?.title) {
			details = {
				...details,
				mediaType: 'movie',
				title: movie.title ?? details.title,
				year: (movie.release_date ?? '').slice(0, 4) || null,
				overview: movie.overview ?? null,
				backdropPath: movie.backdrop_path ?? null,
				posterPath: movie.poster_path ?? null
			};
			const videos = await fetchJson(
				`${TMDB_BASE}/movie/${id}/videos?api_key=${apiKey}&language=en`
			);
			details.trailerKey = collectYoutubeKeys(videos)[0] ?? null;
			details.youtubeIds = [
				...details.youtubeIds,
				...collectYoutubeKeys(videos).filter((k) => !details.youtubeIds.includes(k))
			];
			return { details, reachability: await probeSources('movie', Number(id), 1, 1) };
		}
	}

	const tv = await fetchJson(`${TMDB_BASE}/tv/${id}?api_key=${apiKey}`);
	if (tv?.name) {
		details = {
			...details,
			mediaType: 'tv',
			title: tv.name ?? details.title,
			year: (tv.first_air_date ?? '').slice(0, 4) || null,
			overview: tv.overview ?? null,
			backdropPath: tv.backdrop_path ?? null,
			posterPath: tv.poster_path ?? null
		};
		const videos = await fetchJson(`${TMDB_BASE}/tv/${id}/videos?api_key=${apiKey}&language=en`);
		details.trailerKey = collectYoutubeKeys(videos)[0] ?? null;
		details.youtubeIds = [
			...details.youtubeIds,
			...collectYoutubeKeys(videos).filter((k) => !details.youtubeIds.includes(k))
		];
		return { details, reachability: await probeSources('tv', Number(id), 1, 1) };
	}

	return { details, reachability: await probeSources(details.mediaType, Number(id), 1, 1) };
}
