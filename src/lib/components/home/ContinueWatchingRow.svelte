<script lang="ts">
	import MediaScrollContainer from '$lib/components/media/MediaScrollContainer.svelte';
	import { page } from '$app/state';
	import { onMount } from 'svelte';
	import type { LibraryMovie } from '$lib/types/library';
	import {
		playbackStore,
		shouldShowInContinueWatching,
		type PlaybackProgress
	} from '$lib/state/stores/playbackStore.svelte';
	import { SvelteMap } from 'svelte/reactivity';

	type ContinueWatchingEntry = {
		mediaId: string;
		progress: number;
		duration: number;
		seasonNumber?: number;
		episodeNumber?: number;
		updatedAt?: number;
	};

	type LibraryMovieWithProgress = LibraryMovie & {
		seasonNumber?: number | null;
		episodeNumber?: number | null;
		progressSeconds?: number;
		durationSeconds?: number;
		updatedAt?: number;
		progressPercent?: number;
		progressLabel?: string;
		resumeHref?: string;
	};

	let continueWatchingMovies = $state<LibraryMovieWithProgress[]>([]);
	let isLoading = $state(true);

	function getMediaKey(id: string | number, season?: number, episode?: number) {
		return `${id}-${season ?? 0}-${episode ?? 0}`;
	}

	function buildResumeHref(movie: LibraryMovie, season?: number, episode?: number) {
		if (movie.mediaType !== 'movie' && season) {
			return `/tv/${movie.id}/${season}/${episode ?? 1}`;
		}
		return `/movie/${movie.id}`;
	}

	function buildProgressLabel(movie: LibraryMovie, season?: number, episode?: number) {
		if (movie.mediaType !== 'movie' && season) return `S${season}E${episode}`;
		return '';
	}

	onMount(async () => {
		const localProgress = playbackStore.getContinueWatching() as LibraryMovieWithProgress[];
		localProgress.forEach((movie) => {
			if (movie.mediaType !== 'movie') {
				movie.progressLabel = buildProgressLabel(movie, movie.seasonNumber ?? undefined, movie.episodeNumber ?? undefined);
			}
			movie.resumeHref = buildResumeHref(movie, movie.seasonNumber ?? undefined, movie.episodeNumber ?? undefined);
		});
		continueWatchingMovies = localProgress;

		if (!page.data.user) {
			isLoading = false;
			return;
		}

		try {
			const progressRes = await fetch('/api/playback/progress', { credentials: 'include' });
			if (!progressRes.ok) throw new Error(progressRes.statusText);

			const { continueWatching } = (await progressRes.json()) as {
				continueWatching: ContinueWatchingEntry[];
			};
			if (!Array.isArray(continueWatching) || continueWatching.length === 0) {
				isLoading = false;
				return;
			}

			const movieIds = [...new Set(continueWatching.map((p) => p.mediaId))];
			const moviesRes = await fetch(`/api/media/batch?ids=${movieIds.join(',')}`, {
				credentials: 'include'
			});
			if (!moviesRes.ok) throw new Error(moviesRes.statusText);

			const { media: fetchedMovies } = (await moviesRes.json()) as {
				media: LibraryMovie[];
			};
			const movieLookup = new SvelteMap<string, LibraryMovie>();
			fetchedMovies.forEach((movie) => {
				if (movie.id) {
					movieLookup.set(String(movie.id), movie);
				}
			});

			const serverMovies = continueWatching.flatMap((progress) => {
				const movie = movieLookup.get(progress.mediaId);
				if (!movie) return [];

				const pct = progress.duration > 0 ? Math.round((progress.progress / progress.duration) * 100) : 0;
				const label = buildProgressLabel(movie, progress.seasonNumber, progress.episodeNumber) || `${pct}%`;
				return [
					{
						...movie,
						progressSeconds: progress.progress,
						durationSeconds: progress.duration,
						seasonNumber: progress.seasonNumber,
						episodeNumber: progress.episodeNumber,
						updatedAt: progress.updatedAt,
						progressPercent: pct,
						progressLabel: label,
						resumeHref: buildResumeHref(movie, progress.seasonNumber, progress.episodeNumber)
					} satisfies LibraryMovieWithProgress
				];
			});

			const combinedMap = new SvelteMap<string, LibraryMovieWithProgress>();

			localProgress.forEach((movie) => {
				const key = getMediaKey(
					movie.id,
					movie.seasonNumber ?? undefined,
					movie.episodeNumber ?? undefined
				);
				combinedMap.set(key, movie);
			});

			serverMovies.forEach((movie) => {
				const key = getMediaKey(
					movie.id,
					movie.seasonNumber ?? undefined,
					movie.episodeNumber ?? undefined
				);
				combinedMap.set(key, movie);
			});

			continueWatchingMovies = Array.from(combinedMap.values())
				.filter((movie) => {
					const progress: PlaybackProgress = {
						mediaId: movie.id.toString(),
						mediaType: (movie.mediaType as 'movie' | 'tv') || 'movie',
						progress: movie.progressSeconds || 0,
						duration: movie.durationSeconds || 0,
						updatedAt: movie.updatedAt || 0
					};

					return shouldShowInContinueWatching(progress);
				})
				.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
		} catch (error) {
			const status = (error as { status?: number }).status;
			if (status !== 401) {
				console.error('[ContinueWatchingRow] Failed to fetch:', error);
			}
		} finally {
			isLoading = false;
		}
	});
</script>

{#if !isLoading && continueWatchingMovies.length > 0}
	<MediaScrollContainer title="Continue Watching" media={continueWatchingMovies} />
{/if}
