import type { PageServerLoad } from './$types';
import { libraryRepository } from '$lib/server';
import { fromSlug, toSlug } from '$lib/utils';
import { parseAllFromURL } from '$lib/utils/filterUrl';
import type { MovieFilters, SortOptions } from '$lib/types/filters';
import type { PaginationParams } from '$lib/types/pagination';
import { DEFAULT_PAGE_SIZE } from '$lib/types/pagination';
import type { LibraryMedia } from '$lib/types/library';

const CATEGORY_PRESETS: Record<string, { title: string; genres: string[] }> = {
	movies: {
		title: 'Movies',
		genres: ['Action', 'Comedy', 'Drama', 'Horror', 'Science Fiction', 'Thriller']
	},
	'tv-shows': {
		title: 'TV Shows',
		genres: ['Animation', 'Documentary', 'Family', 'Kids', 'Mystery', 'Reality']
	}
};

async function getGenres(): Promise<Array<{ id: number; name: string }>> {
	try {
		return await libraryRepository.listGenres();
	} catch {
		return [];
	}
}

async function fetchTmdbTrending(mediaType: 'movie' | 'tv', limit = 20): Promise<LibraryMedia[]> {
	try {
		const { api } = await import('$lib/server/services/tmdb.client');
		const data = await api(`/trending/${mediaType}/week`, {
			query: { language: 'en-US', page: '1' }
		}) as { results: Array<{ id: number; title?: string; name?: string; overview?: string; poster_path?: string; backdrop_path?: string; release_date?: string; first_air_date?: string; vote_average?: number; genre_ids?: number[]; media_type?: string }> };

		return (data.results || []).slice(0, limit).map((item) => {
			const prefix = mediaType === 'tv' ? '/tv/' : '/movie/';
			return {
				id: String(item.id),
				tmdbId: item.id,
				title: item.title || item.name || 'Untitled',
				overview: item.overview || null,
				posterPath: item.poster_path || null,
				backdropPath: item.backdrop_path || null,
				releaseDate: item.release_date || item.first_air_date || null,
				rating: item.vote_average || null,
				durationMinutes: null,
				is4K: false,
				isHD: true,
				mediaType,
				media_type: mediaType,
				genres: [],
				imdbId: null,
				trailerUrl: null,
				canonicalPath: `${prefix}${item.id}`
			} as unknown as LibraryMedia;
		});
	} catch {
		return [];
	}
}

export const load: PageServerLoad = async ({ params, url }) => {
	const { slug } = params;
	const { filters, sort, pagination, include_anime } = parseAllFromURL(url.searchParams);

	const hasActiveFilters =
		filters.yearFrom ||
		filters.yearTo ||
		filters.minRating !== undefined ||
		filters.maxRating !== undefined ||
		filters.runtimeMin !== undefined ||
		filters.runtimeMax !== undefined ||
		filters.language ||
		(filters.genres && filters.genres.length > 0);

	const preset = CATEGORY_PRESETS[slug];
	let categoryTitle = preset?.title ?? '';
	let genresToFetch = preset?.genres ?? [];
	let singleGenreMode = false;

	if (!preset) {
		const genres = await getGenres();
		const match = genres.find((genre) => toSlug(genre.name) === slug);

		if (!match) {
			if (hasActiveFilters) {
				const mediaType = slug === 'tv-shows' ? 'tv' : 'movie';
				let result;
				try {
					result = await libraryRepository.findMoviesWithFilters(
						filters,
						sort,
						pagination,
						mediaType,
						include_anime
					);
				} catch {
					result = { items: [], pagination: { page: 1, pageSize: DEFAULT_PAGE_SIZE, totalItems: 0, totalPages: 0 } };
				}
				const availableGenres = await getGenres();

				if (result.items.length > 0) {
					return {
						categoryTitle: fromSlug(slug),
						movies: result.items,
						pagination: result.pagination,
						filters,
						sort,
						hasContent: true,
						singleGenreMode: true,
						availableGenres,
						useFilters: true,
						include_anime
					};
				}

				const fallbackMovies = await fetchTmdbTrending(mediaType);
				return {
					categoryTitle: fromSlug(slug),
					movies: fallbackMovies,
					pagination: { page: 1, pageSize: DEFAULT_PAGE_SIZE, totalItems: fallbackMovies.length, totalPages: 1 },
					filters,
					sort,
					hasContent: fallbackMovies.length > 0,
					singleGenreMode: true,
					availableGenres,
					useFilters: true,
					include_anime
				};
			}

			return {
				categoryTitle: fromSlug(slug),
				genreData: [],
				hasContent: false,
				singleGenreMode: true,
				availableGenres: await getGenres(),
				useFilters: false,
				include_anime
			};
		}

		categoryTitle = match.name;
		genresToFetch = [match.name];
		singleGenreMode = true;
	}

	if (hasActiveFilters) {
		const finalFilters: MovieFilters = { ...filters };
		if (singleGenreMode && genresToFetch.length === 1) {
			finalFilters.genres = [genresToFetch[0], ...(finalFilters.genres || [])];
		}

		const mediaType = slug === 'tv-shows' ? 'tv' : 'movie';
		let result;
		try {
			result = await libraryRepository.findMoviesWithFilters(
				finalFilters,
				sort,
				pagination,
				mediaType,
				include_anime
			);
		} catch {
			result = { items: [], pagination: { page: 1, pageSize: DEFAULT_PAGE_SIZE, totalItems: 0, totalPages: 0 } };
		}
		const availableGenres = await getGenres();

		if (result.items.length > 0) {
			return {
				categoryTitle,
				movies: result.items,
				pagination: result.pagination,
				filters: finalFilters,
				sort,
				hasContent: true,
				singleGenreMode,
				availableGenres,
				useFilters: true,
				include_anime
			};
		}

		const fallbackMovies = await fetchTmdbTrending(mediaType);
		return {
			categoryTitle,
			movies: fallbackMovies,
			pagination: { page: 1, pageSize: DEFAULT_PAGE_SIZE, totalItems: fallbackMovies.length, totalPages: 1 },
			filters: finalFilters,
			sort,
			hasContent: fallbackMovies.length > 0,
			singleGenreMode,
			availableGenres,
			useFilters: true,
			include_anime
		};
	}

	let genreData;
	try {
		genreData = await Promise.all(
			genresToFetch.map(async (genreName) => ({
				genre: genreName,
				slug: toSlug(genreName),
				movies: await libraryRepository.findGenreMovies(
					genreName,
					undefined,
					undefined,
					slug === 'tv-shows' ? 'tv' : 'movie',
					include_anime
				)
			}))
		);
	} catch {
		genreData = [];
	}

	const totalMovies = genreData.reduce((sum, g) => sum + g.movies.length, 0);

	if (totalMovies < 8) {
		const mediaType = slug === 'tv-shows' ? 'tv' : 'movie';
		const fallbackMovies = await fetchTmdbTrending(mediaType);
		if (fallbackMovies.length > 0) {
			const availableGenres = await getGenres();
			return {
				categoryTitle,
				genreData: [{ genre: categoryTitle, slug: toSlug(categoryTitle), movies: fallbackMovies }],
				hasContent: true,
				singleGenreMode,
				availableGenres,
				useFilters: false,
				filters: {} as MovieFilters,
				sort: { field: 'popularity', order: 'desc' } as SortOptions,
				pagination: { page: 1, pageSize: DEFAULT_PAGE_SIZE } as PaginationParams,
				include_anime
			};
		}
	}

	const availableGenres = await getGenres();
	const hasContent = totalMovies > 0;

	return {
		categoryTitle,
		genreData,
		hasContent,
		singleGenreMode,
		availableGenres,
		useFilters: false,
		filters: {} as MovieFilters,
		sort: { field: 'popularity', order: 'desc' } as SortOptions,
		pagination: { page: 1, pageSize: DEFAULT_PAGE_SIZE } as PaginationParams,
		include_anime
	};
};
