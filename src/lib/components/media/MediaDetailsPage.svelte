<script lang="ts">
	import { onMount, untrack } from 'svelte';
	import { page } from '$app/state';
	import type { ProviderResolution } from '$lib/streaming/provider-registry';
	import type { StreamingSource } from '$lib/streaming';
	import { watchHistory } from '$lib/state/stores/historyStore';
	import { MediaScrollContainer } from '$lib/components';
	import type { LibraryMedia } from '$lib/types/library';
	import { SEOHead, StructuredData } from '$lib/components/seo';
	import { StreamingService, type MediaType } from '$lib/streaming/streamingService.svelte';
	import { PlayerService } from '$lib/components/player/playerService.svelte';
	import {
		createEpisodeService,
		type Season
	} from '$lib/components/episodes/episodeService.svelte';
	import MediaHeader from '$lib/components/media/MediaHeader.svelte';
	import EpisodeGrid from '$lib/components/episodes/EpisodeGrid.svelte';
	import MediaOverview from '$lib/components/media/MediaOverview.svelte';
	import { Separator } from '$lib/components/ui/separator';
	import { playbackStore } from '$lib/state/stores/playbackStore.svelte';
	import InlinePlayer from '$lib/components/player/InlinePlayer.svelte';

	type MediaGenre = { id: number; name: string };
	type MediaCastMember = {
		id: number;
		name: string;
		character: string;
		profilePath?: string | null;
	};

	type MediaDetails = {
		id: string;
		tmdbId: number | null;
		title: string;
		overview: string | null;
		posterPath: string | null;
		backdropPath: string | null;
		releaseDate: string | null;
		rating: number | null;
		durationMinutes: number | null;
		episodeRuntimes?: number[];
		genres?: MediaGenre[];
		cast?: MediaCastMember[];
		trailerUrl?: string | null;
		imdbId?: string | null;
		media_type?: string | null;
		is4K?: boolean;
		isHD?: boolean | null;
		collectionId?: number | null;
		seasonCount?: number | null;
		episodeCount?: number | null;
		seasons?: Season[];
		productionCompanies?: { id: number; name: string; logoPath: string | null }[];
		productionCountries?: { iso: string; name: string }[];
		voteCount?: number | null;
		logoPath?: string | null;
		malId?: number;
	};

	type StreamingPayloadLike = {
		source: StreamingSource | null;
		resolutions: ProviderResolution[] | ReadonlyArray<ProviderResolution>;
	};

	const props = $props<{
		data: {
			movie: MediaDetails | null;
			streaming?: StreamingPayloadLike;
			mediaType?: MediaType;
			recommendations?: LibraryMedia[];
			csrfToken?: string;
			canonicalPath?: string;
		} & Record<string, unknown>;
	}>();

	const movie = $derived(props.data.movie ?? null);
	const mediaType = $derived((props.data.mediaType ?? 'movie') as MediaType);
	const canonicalPath = $derived(props.data.canonicalPath as string | undefined);
	const data = $derived(props.data);

	const streamingService = new StreamingService();
	const playerService = new PlayerService();
	const episodeService = createEpisodeService();

	let selectedSeason = $state<number>(1);
	let selectedEpisode = $state<number>(1);
	let subOrDub = $state<'sub' | 'dub'>('sub');
	let activeTab = $state<'suggested' | 'details'>('suggested');
	let activeEmbedUrl = $state<string | null>(null);

	onMount(() => {
		playerService.init();
		if (movie) {
			streamingService.setCurrentMedia({
				mediaId: movie.id,
				tmdbId: movie.tmdbId,
				mediaType: mediaType,
				season: mediaType === 'tv' || mediaType === 'anime' ? selectedSeason : undefined,
				episode: mediaType === 'tv' || mediaType === 'anime' ? selectedEpisode : undefined
			});
			if (data.streaming) {
				streamingService.initializeFromServerData({
					source: data.streaming.source ?? null,
					resolutions: Array.isArray(data.streaming.resolutions)
						? [...data.streaming.resolutions]
						: []
				});
			}
		}
		return () => playerService.destroy();
	});

	async function handlePlayClick() {
		if (!streamingService.currentProviderId) {
			streamingService.state.error = 'Select a provider before playing.';
			return;
		}

		if (
			streamingService.isResolved &&
			streamingService.state.source?.providerId === streamingService.currentProviderId
		) {
			return;
		}

		const savedProgress = playbackStore.getProgress(
			movie?.id ?? '',
			mediaType,
			mediaType !== 'movie' ? selectedSeason : undefined,
			mediaType !== 'movie' ? selectedEpisode : undefined
		);

		const resolveParams = {
			tmdbId: Number(movie?.tmdbId),
			mediaType: mediaType,
			imdbId: movie?.imdbId ?? undefined,
			malId: movie?.malId ?? undefined,
			subOrDub: mediaType === 'anime' ? subOrDub : undefined,
			season: mediaType !== 'movie' ? selectedSeason : undefined,
			episode: mediaType !== 'movie' ? selectedEpisode : undefined,
			preferredQuality: playerService.selectedQuality,
			preferredSubtitleLanguage: playerService.selectedSubtitle,
			csrfToken: data.csrfToken,
			startAt: savedProgress?.progress ? Math.floor(savedProgress.progress) : undefined
		};

		try {
			await streamingService.resolveProvider(streamingService.currentProviderId, resolveParams);
		} catch (e) {
			console.error('[play] Resolve failed, will use fallback:', e);
		}
	}

	function handleEpisodeSelect(episodeNum: number) {
		selectedEpisode = episodeNum;
		activeEmbedUrl = null;
		streamingService.reset();
		playerService.cleanup();

		const pid = streamingService.currentProviderId;
		if (pid) {
			const embedUrl = buildDirectEmbedUrl(pid);
			if (embedUrl) {
				activeEmbedUrl = embedUrl;
			} else {
				handlePlayClick();
			}
		}
	}

	function closePlayer() {
		activeEmbedUrl = null;
	}

	function handleSeasonChange(value: string) {
		selectedSeason = Number(value);
		selectedEpisode = 1;
		activeEmbedUrl = null;

		streamingService.reset();
		playerService.cleanup();
		streamingService.state.qualities = [];
		streamingService.state.subtitles = [];

		if (movie?.tmdbId && (mediaType === 'tv' || mediaType === 'anime')) {
			episodeService.fetchEpisodes(movie.tmdbId, selectedSeason);
		}
	}

	function goToNextEpisode() {
		const next = episodeService.getNextEpisode(movie?.seasons, selectedSeason, selectedEpisode);
		if (next) {
			if (next.season !== selectedSeason) {
				selectedSeason = next.season;
				selectedEpisode = 1;
				activeEmbedUrl = null;
				streamingService.reset();
				playerService.cleanup();
				streamingService.state.qualities = [];
				streamingService.state.subtitles = [];
				if (movie?.tmdbId && (mediaType === 'tv' || mediaType === 'anime')) {
					episodeService.fetchEpisodes(movie.tmdbId, selectedSeason);
				}
			}
			handleEpisodeSelect(next.episode);
		}
	}

	const EMBED_PROVIDERS = [
		{ id: 'vidlink', label: 'VidLink' },
		{ id: 'vidsrc', label: 'VidSrc' },
		{ id: '2embed', label: '2Embed' },
		{ id: 'superembed', label: 'SuperEmbed' },
		{ id: 'autoembed', label: 'AutoEmbed' },
		{ id: 'multiembed', label: 'MultiEmbed' }
	] as const;

	function buildDirectEmbedUrl(providerId: string): string | null {
		if (!movie?.tmdbId) return null;
		const customParams = `primaryColor=63b8bc&secondaryColor=a2a2a2&iconColor=eefdec&icons=default&player=default&title=false&poster=true&autoplay=true&nextbutton=false`;

		if (providerId === 'vidlink') {
			if (mediaType === 'anime') {
				const episode = selectedEpisode ?? 1;
				const type = subOrDub ?? 'sub';
				return `https://vidlink.pro/anime/${movie.malId ?? movie.tmdbId}/${episode}/${type}?${customParams}&fallback=true`;
			}
			if (mediaType === 'tv') {
				return `https://vidlink.pro/tv/${movie.tmdbId}/${selectedSeason}/${selectedEpisode}?${customParams}`;
			}
			return `https://vidlink.pro/movie/${movie.tmdbId}?${customParams}`;
		}

		if (providerId === 'vidsrc') {
			const baseUrls = [
				'https://vidsrcme.su',
				'https://vidsrc-embed.su',
				'https://vidsrc-embed.ru',
				'https://vidsrc.me',
				'https://vsrc.su'
			];
			for (const base of baseUrls) {
				const url = mediaType === 'movie'
					? `${base}/embed/movie?tmdb=${movie.tmdbId}`
					: `${base}/embed/tv?tmdb=${movie.tmdbId}&season=${selectedSeason}&episode=${selectedEpisode}`;
				return url;
			}
			return null;
		}

		if (providerId === '2embed') {
			const mediaId = movie.imdbId || movie.tmdbId;
			const embedBase = 'https://hnembed.cc';
			if (mediaType === 'movie') return `${embedBase}/embed/movie/${mediaId}`;
			if (mediaType === 'tv') return `${embedBase}/embed/tv/${mediaId}/${selectedSeason}/${selectedEpisode}`;
			return `https://player.autoembed.cc/embed/anime/${movie.malId ?? movie.tmdbId}/${selectedEpisode ?? 1}${subOrDub === 'dub' ? '/dub' : ''}`;
		}

		if (providerId === 'superembed' || providerId === 'autoembed') {
			if (mediaType === 'anime') {
				return `https://player.autoembed.cc/embed/anime/${movie.malId ?? movie.tmdbId}/${selectedEpisode ?? 1}${subOrDub === 'dub' ? '/dub' : ''}`;
			}
			return `https://player.autoembed.cc/embed/${mediaType === 'movie' ? 'movie' : 'tv'}/${movie.tmdbId}${mediaType !== 'movie' ? `/${selectedSeason}/${selectedEpisode}` : ''}`;
		}

		if (providerId === 'multiembed') {
			const source = movie.imdbId ? 'imdb' : 'tmdb';
			const id = movie.imdbId ?? movie.tmdbId.toString();
			if (mediaType === 'movie') return `https://multiembed.mov/movie?${source}=${id}`;
			return `https://multiembed.mov/tv?${source}=${id}&s=${selectedSeason}&e=${selectedEpisode}`;
		}

		return null;
	}

	function tryPlayWithFallback(providerId: string): string | null {
		const providersToTry = providerId
			? [providerId, ...EMBED_PROVIDERS.map((p) => p.id).filter((id) => id !== providerId)]
			: EMBED_PROVIDERS.map((p) => p.id);

		for (const pid of providersToTry) {
			const embedUrl = buildDirectEmbedUrl(pid);
			if (embedUrl) return embedUrl;
		}

		return null;
	}

	async function handleHeaderPlay(providerId: string) {
		if (mediaType !== 'movie' && movie?.id) {
			const savedProgress = playbackStore.getProgress(
				movie.id,
				mediaType,
				selectedSeason,
				selectedEpisode
			);
			if (!savedProgress) {
				const anyProgress = playbackStore.getProgress(movie.id, mediaType as 'movie' | 'tv' | 'anime');
				if (!anyProgress) {
					selectedSeason = 1;
					selectedEpisode = 1;
					if (movie.tmdbId && episodeService.episodesList.length === 0) {
						await episodeService.fetchEpisodes(movie.tmdbId, 1);
					}
				}
			}
		}

		streamingService.selectProvider(providerId);
		await handlePlayClick();

		const embedUrl = tryPlayWithFallback(providerId);
		if (embedUrl) {
			activeEmbedUrl = embedUrl;
			return;
		}

		const playbackUrl =
			streamingService.state.source?.embedUrl ?? streamingService.state.source?.streamUrl ?? null;
		if (playbackUrl) {
			activeEmbedUrl = playbackUrl;
			return;
		}

		streamingService.state.error = 'No working stream found. Please try a different provider.';
	}

	$effect(() => {
		if (!streamingService.hasResolutions) return;
		untrack(() => {
			const id =
				streamingService.state.source?.providerId ??
				streamingService.state.resolutions.find((r) => r.success)?.providerId ??
				streamingService.state.resolutions[0]?.providerId;
			if (id) streamingService.selectProvider(id);
		});
	});

	$effect(() => {
		if (streamingService.isResolved && movie) {
			untrack(() => {
				playerService.startProgressTracking(movie.durationMinutes, async (progress) => {
					if (!movie) return;
					playbackStore.saveProgress({
						mediaId: movie.id,
						mediaType,
						progress,
						duration: movie.durationMinutes ? movie.durationMinutes * 60 : 0,
						seasonNumber: mediaType !== 'movie' ? selectedSeason : undefined,
						episodeNumber: mediaType !== 'movie' ? selectedEpisode : undefined,
						updatedAt: Date.now(),
						mediaData: { ...movie, mediaType } as LibraryMedia
					});
				});
			});
		} else {
			playerService.stopProgressTracking();
		}
	});

	$effect(() => {
		function handleKeyDown(event: KeyboardEvent) {
			if (
				event.target instanceof HTMLInputElement ||
				event.target instanceof HTMLTextAreaElement ||
				event.target instanceof HTMLSelectElement
			) {
				return;
			}

			switch (event.key.toLowerCase()) {
				case 'n':
					if (streamingService.isResolved && mediaType !== 'movie') {
						event.preventDefault();
						goToNextEpisode();
					}
					break;
				case 'p':
					if (streamingService.isResolved && mediaType !== 'movie' && selectedEpisode > 1) {
						event.preventDefault();
						handleEpisodeSelect(selectedEpisode - 1);
					}
					break;
				case 'arrowright':
				case 'arrowleft':
					if (streamingService.isResolved) {
						event.preventDefault();
					}
					break;
				case '+':
				case '=':
					if (streamingService.isResolved) {
						event.preventDefault();
						playerService.handlePlaybackSpeedChange(playerService.playbackSpeed + 0.25);
					}
					break;
				case '-':
					if (streamingService.isResolved) {
						event.preventDefault();
						playerService.handlePlaybackSpeedChange(playerService.playbackSpeed - 0.25);
					}
					break;
			}
		}

		window.addEventListener('keydown', handleKeyDown);
		return () => window.removeEventListener('keydown', handleKeyDown);
	});

	onMount(() => {
		if (movie?.id) {
			const normalizedGenres = movie.genres?.map((g: MediaGenre) => g.name || String(g)) ?? [];

			watchHistory.recordWatch({
				id: movie.id,
				title: movie.title,
				posterPath: movie.posterPath ?? null,
				backdropPath: movie.backdropPath ?? null,
				overview: movie.overview ?? null,
				releaseDate: movie.releaseDate ? new Date(movie.releaseDate).toISOString() : null,
				rating: movie.rating ?? 0,
				genres: normalizedGenres,
				trailerUrl: movie.trailerUrl ?? null,
				mediaType: mediaType,
				is4K: Boolean(movie.is4K),
				isHD: movie.isHD ?? undefined,
				tmdbId: movie.tmdbId ?? undefined,
				imdbId: movie.imdbId ?? undefined,
				durationMinutes: movie.durationMinutes ?? null,
				collectionId: movie.collectionId ?? null,
				...(mediaType !== 'movie'
					? {
							season: selectedSeason,
							episode: selectedEpisode
						}
					: {})
			});
		}

		if (mediaType !== 'movie' && movie?.tmdbId) {
			episodeService.fetchEpisodes(movie.tmdbId, selectedSeason);
		}
	});

	const ogImage = $derived(
		movie?.backdropPath
			? movie.backdropPath.startsWith('http')
				? movie.backdropPath
				: `https://image.tmdb.org/t/p/w1280${movie.backdropPath}`
			: movie?.posterPath
				? movie.posterPath.startsWith('http')
					? movie.posterPath
					: `https://image.tmdb.org/t/p/w780${movie.posterPath}`
				: null
	);

	const notFoundHeading = $derived(
		mediaType === 'tv' || mediaType === 'anime' ? 'Series Not Found' : 'Movie Not Found'
	);
	const notFoundDescription = $derived(
		mediaType === 'tv' || mediaType === 'anime'
			? 'The show you are looking for does not exist.'
			: 'The movie you are looking for does not exist.'
	);

	const availableProviders = $derived(
		streamingService.state.resolutions.length > 0
			? streamingService.state.resolutions
			: data.streaming?.resolutions || []
	);
</script>

{#if movie}
	<SEOHead
		title={movie.title}
		description={movie.overview ||
			`Watch ${movie.title} on Streamium - Free streaming of movies and TV shows`}
		canonical={canonicalPath ?? undefined}
		ogType={mediaType === 'tv' || mediaType === 'anime' ? 'video.tv_show' : 'video.movie'}
		ogImage={ogImage ?? undefined}
		ogImageAlt={`${movie.title} poster`}
		twitterCard="summary_large_image"
		keywords={[
			movie.title,
			...(movie.genres?.map((g: MediaGenre) => g.name) || []),
			mediaType === 'tv' || mediaType === 'anime' ? 'TV show' : 'movie',
			'watch online',
			'free streaming'
		]}
		publishedTime={movie.releaseDate || undefined}
	/>
	<StructuredData media={movie} {mediaType} canonicalUrl={canonicalPath} />
{:else}
	<SEOHead title={notFoundHeading} description={notFoundDescription} noindex={true} />
{/if}

{#if !movie}
	<div class="flex min-h-screen flex-col items-center justify-center text-foreground">
		<h1 class="text-4xl font-bold">{notFoundHeading}</h1>
		<p class="text-lg">{notFoundDescription}</p>
	</div>
{:else}
	<div class="page-transition min-h-screen text-foreground">
		<main class="mx-auto">
			<MediaHeader
				{movie}
				logoPath={movie.logoPath}
				providers={availableProviders}
				onProviderSelect={handleHeaderPlay}
			/>

			{#if mediaType === 'anime'}
				<div class="mb-6 flex items-center justify-center gap-4">
					<span class="text-sm font-medium tracking-wider text-muted-foreground uppercase"
						>Type:</span
					>
					<div class="flex rounded-md bg-muted p-1">
						<button
							class="rounded px-4 py-1.5 text-sm font-medium transition-all {subOrDub === 'sub'
								? 'bg-background text-foreground shadow-sm'
								: 'text-muted-foreground hover:text-foreground'}"
							onclick={() => {
								subOrDub = 'sub';
							}}
						>
							Sub
						</button>
						<button
							class="rounded px-4 py-1.5 text-sm font-medium transition-all {subOrDub === 'dub'
								? 'bg-background text-foreground shadow-sm'
								: 'text-muted-foreground hover:text-foreground'}"
							onclick={() => {
								subOrDub = 'dub';
							}}
						>
							Dub
						</button>
					</div>
				</div>
			{/if}

			<div class="mt-8 w-full">
				<div class="px-[10%]">
					<div class="mb-2 flex gap-2">
						<button
							class="px-3 py-1 text-sm font-medium transition-colors {activeTab === 'suggested'
								? 'text-primary'
								: 'text-muted-foreground hover:text-foreground'}"
							onclick={() => (activeTab = 'suggested')}
						>
							Suggested
						</button>
						<button
							class="px-3 py-1 text-sm font-medium transition-colors {activeTab === 'details'
								? 'text-primary'
								: 'text-muted-foreground hover:text-foreground'}"
							onclick={() => (activeTab = 'details')}
						>
							Details
						</button>
					</div>
					<Separator class="mb-2" />
				</div>

				{#if activeTab === 'suggested'}
					<div>
						{#if data.recommendations && data.recommendations.length > 0}
							<MediaScrollContainer title="" media={data.recommendations} />
						{:else}
							<div class="py-12 text-center text-muted-foreground">
								No recommendations available.
							</div>
						{/if}
					</div>
				{:else if activeTab === 'details'}
					<div>
						{#if (mediaType === 'tv' || mediaType === 'anime') && movie.seasons}
							<div class="mb-10">
								<h3 class="mb-4 text-2xl font-bold">Episodes</h3>
								<EpisodeGrid
									episodes={episodeService.episodesList}
									{selectedEpisode}
									{selectedSeason}
									seasons={movie.seasons}
									isLoading={episodeService.isLoadingEpisodes}
									onSeasonChange={handleSeasonChange}
									onEpisodeSelect={handleEpisodeSelect}
								/>
							</div>
						{/if}

						<section class="grid gap-6 lg:grid-cols-[70%,30%]">
							<div class="space-y-4">
								<MediaOverview
									cast={movie.cast}
									productionCompanies={movie.productionCompanies}
									posterPath={movie.posterPath}
									title={movie.title}
									overview={movie.overview ?? null}
								/>
							</div>
						</section>
					</div>
				{/if}
			</div>
		</main>
	</div>

	{#if activeEmbedUrl}
		<InlinePlayer src={activeEmbedUrl} title={movie?.title ?? 'Player'} onClose={closePlayer} />
	{/if}
{/if}
