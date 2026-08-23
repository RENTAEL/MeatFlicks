<script lang="ts">
	import { untrack } from 'svelte';
	import { goto } from '$app/navigation';
	import Player from '$lib/components/Player.svelte';
	import MovieInfo from '$lib/components/MovieInfo.svelte';
	import MediaCard from '$lib/components/media/MediaCard.svelte';
	import { toLibraryMovie } from '$lib/utils/tmdb';
	import { getImageUrl } from '$lib/utils/image';
	import { watchHistory } from '$lib/state/stores/historyStore';
	import { createWatchParty } from '$lib/watch-party/client';
	import { WATCH_PARTY_ENABLED } from '$lib/config/watchParty';
	import WpJoinOverlay from '$lib/components/watch-party/WpJoinOverlay.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	let joining = $state(false);
	let joinError = $state('');

	async function startParty() {
		if (joining || !data.movie || !WATCH_PARTY_ENABLED) return;
		joining = true;
		joinError = '';
		const result = await createWatchParty({ mediaType: 'movie', tmdbId: data.movie.id });
		if (result.ok) {
			await goto(`/watch/${result.roomId}`);
			return;
		}
		if (result.reason === 'auth') {
			await goto(`/login?next=${encodeURIComponent(`/movie/${data.movie.id}`)}`);
			return;
		}
		joinError =
			result.reason === 'timeout'
				? 'The room took too long to respond. Check your connection and retry.'
				: 'The server could not create the room right now. Retrying usually fixes it.';
	}

	function retryParty() {
		startParty();
	}

	function dismissJoin() {
		joining = false;
		joinError = '';
	}

	$effect(() => {
		if (data.movie) {
			untrack(() => {
				watchHistory.recordWatch({
					id: String(data.movie.id),
					title: data.movie.title,
					posterPath: data.movie.poster_path,
					backdropPath: data.movie.backdrop_path,
					overview: data.movie.overview,
					releaseDate: data.movie.release_date,
					rating: data.movie.vote_average,
					genres: (data.movie.genres ?? []).map((g: { name: string }) => g.name),
					imdbId: data.movie.imdb_id,
					media_type: 'movie',
					tmdb_id: data.movie.id
				});
			});
		}
	});
</script>

<svelte:head>
	<title
		>{data.movie ? `${data.movie.title} — Watch Online | Streamium` : 'Movies | Streamium'}</title
	>
	{#if data.movie}
		<meta
			name="description"
			content={data.movie.overview?.slice(0, 155) ?? `Watch ${data.movie.title} on Streamium.`}
		/>
		<meta property="og:type" content="video.movie" />
		<meta property="og:title" content={data.movie.title} />
		<meta property="og:description" content={data.movie.overview?.slice(0, 155) ?? ''} />
		{#if data.movie.poster_path}
			<meta
				property="og:image"
				content={`https://streamium-cosmic.vercel.app${getImageUrl(data.movie.poster_path, 'w780')}`}
			/>
		{/if}
	{/if}
</svelte:head>

<div class="mx-auto max-w-screen-2xl px-4 py-6 sm:px-6 lg:px-8">
	<a
		href="/movies"
		class="mb-4 inline-flex items-center gap-1.5 text-zinc-400 transition-colors hover:text-white"
	>
		<svg class="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"
			><path
				stroke-linecap="round"
				stroke-linejoin="round"
				stroke-width="2"
				d="M15 19l-7-7 7-7"
			/></svg
		>
		<span class="text-sm">Back to Movies</span>
	</a>

	{#if data.error && !data.movie}
		<div class="flex flex-col items-center justify-center py-20">
			<svg class="mb-4 size-16 text-zinc-700" fill="none" viewBox="0 0 24 24" stroke="currentColor"
				><path
					stroke-linecap="round"
					stroke-linejoin="round"
					stroke-width="1.5"
					d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z"
				/></svg
			>
			<p class="text-lg font-medium text-zinc-400">Failed to load movie</p>
			<p class="mt-1 text-sm text-zinc-600">{data.error}</p>
			<a
				href="/movies"
				class="mt-4 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-500"
			>
				Back to Movies
			</a>
			<button
				onclick={() => window.location.reload()}
				class="mt-4 ml-3 rounded-lg bg-zinc-800 px-4 py-2 text-sm font-medium text-zinc-200 transition-colors hover:bg-zinc-700"
			>
				Retry
			</button>
		</div>
	{:else if data.movie}
		<Player tmdbId={data.movie.id} title={data.movie.title} />

		{#if WATCH_PARTY_ENABLED}
			<div class="mt-3 flex items-center gap-3">
				<button
					onclick={startParty}
					disabled={joining}
					class="inline-flex items-center gap-2 rounded-lg bg-zinc-800 px-4 py-2 text-sm font-medium text-zinc-200 transition-colors hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-60"
				>
					<svg class="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"
						><path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M15 10l4.553-2.276A1 1 0 0 1 21 8.618v6.764a1 1 0 0 1-1.447.894L15 14M5 18h8a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2z"
						/></svg
					>
					Start Watch Party
				</button>
			</div>
		{/if}

		<MovieInfo movie={data.movie} />

		{#if data.similarMovies?.length}
			<div class="mt-10">
				<h2 class="mb-4 text-lg font-semibold text-white">Similar Movies</h2>
				<div
					class="-mx-4 flex gap-4 overflow-x-auto px-4 pb-4 scrollbar-thin scrollbar-thumb-zinc-800 scrollbar-track-transparent"
				>
					{#each data.similarMovies as movie (movie.id)}
						<div class="shrink-0">
							<MediaCard movie={toLibraryMovie(movie)} />
						</div>
					{/each}
				</div>
			</div>
		{/if}
	{/if}
</div>

{#if joining}
	<WpJoinOverlay
		status={joinError ? 'error' : 'joining'}
		message={joinError}
		onretry={retryParty}
		ondismiss={dismissJoin}
	/>
{/if}
