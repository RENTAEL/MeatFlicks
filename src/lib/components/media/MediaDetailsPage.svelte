<script lang="ts">
	import { untrack } from 'svelte';
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
	import ProviderSelector, { type Provider } from '$lib/components/media/ProviderSelector.svelte';
	import { Separator } from '$lib/components/ui/separator';
	import { playbackStore } from '$lib/state/stores/playbackStore.svelte';
	import InlinePlayer from '$lib/components/player/InlinePlayer.svelte';
	import ServerGrid from '$lib/components/ServerGrid.svelte';
	import { scanAllProviders, type ProbeResult } from '$lib/providers/scanner';
	import { SORTED_PROVIDERS, type ProviderParams } from '$lib/providers/index';

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

	type WatchProvider = {
		logo_path: string | null;
		provider_id: number;
		provider_name: string;
		display_priority: number;
	};

	type WatchProviderResult = {
		flatrate: WatchProvider[];
		rent: WatchProvider[];
		buy: WatchProvider[];
	};

	const props = $props<{
		data: {
			movie: MediaDetails | null;
			streaming?: StreamingPayloadLike;
			mediaType?: MediaType;
			recommendations?: LibraryMedia[];
			watchProviders?: WatchProviderResult;
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
	let activeTab = $state<'suggested' | 'details'>('suggested');
	let activeEmbedUrl = $state<string | null>(null);
	let fallbackQueue = $state<string[]>([]);
	let currentFallbackProvider = $state<string | null>(null);
	let isAutoSwitching = $state(false);
	let autoSwitchLabel = $state('');
	let showShortcutsHelp = $state(false);

	// Server scanner state
	let serverResults = $state<ProbeResult[]>([]);
	let serverScanning = $state(false);
	let activeProviderId = $state<string | null>(null);

	// Provider selector state (legacy fallback)
	let showProviderSelector = $state(false);
	let providers: Provider[] = $state([]);

	$effect(() => {
		if (!movie) return;
		const currentMovieId = movie.id;
		selectedSeason = 1;
		selectedEpisode = 1;
		activeEmbedUrl = null;
		fallbackQueue = [];
		currentFallbackProvider = null;
		activeTab = 'suggested';
		untrack(() => {
			streamingService.reset();
			playerService.cleanup();
			playerService.init();

			streamingService.setCurrentMedia({
				mediaId: movie.id,
				tmdbId: movie.tmdbId,
				mediaType: mediaType,
				season: mediaType === 'tv' ? 1 : undefined,
				episode: mediaType === 'tv' ? 1 : undefined
			});
			if (data.streaming) {
				streamingService.initializeFromServerData({
					source: data.streaming.source ?? null,
					resolutions: Array.isArray(data.streaming.resolutions)
						? [...data.streaming.resolutions]
						: []
				});
			}

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
								season: 1,
								episode: 1
							}
						: {})
				});
			}

			if (mediaType !== 'movie' && movie?.tmdbId) {
				episodeService.fetchEpisodes(movie.tmdbId, 1);
			}
		});

		return () => {
			if (currentMovieId) playerService.destroy();
		};
	});

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
				providers = buildProviderList();
				showProviderSelector = true;
			}
		}
	}

	function handleSeasonChange(value: string) {
		selectedSeason = Number(value);
		selectedEpisode = 1;
		activeEmbedUrl = null;

		streamingService.reset();
		playerService.cleanup();
		streamingService.state.qualities = [];
		streamingService.state.subtitles = [];

		if (movie?.tmdbId && mediaType === 'tv') {
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
		if (movie?.tmdbId && mediaType === 'tv') {
				episodeService.fetchEpisodes(movie.tmdbId, selectedSeason);
			}
			}
			handleEpisodeSelect(next.episode);
		}
	}

	const EMBED_PROVIDERS = [
		{ id: 'streamsrc', label: 'StreamSrc' },
		{ id: '2embed.skin', label: '2Embed.Skin' },
		{ id: 'vidlink', label: 'VidLink' },
		{ id: 'vidsrc', label: 'VidSrc' },
		{ id: '2embed', label: '2Embed' },
		{ id: 'superembed', label: 'SuperEmbed' },

	] as const;

	function buildDirectEmbedUrl(providerId: string): string | null {
		if (!movie?.tmdbId) return null;
		const customParams = `primaryColor=63b8bc&secondaryColor=a2a2a2&iconColor=eefdec&icons=default&player=default&title=false&poster=true&autoplay=true&nextbutton=false`;



		if (providerId === 'streamsrc') {
			if (mediaType === 'movie') return `https://streamsrc.cc/watch/movie/${movie.tmdbId}`;
			return `https://streamsrc.cc/watch/series/${movie.tmdbId}`;
		}

		if (providerId === '2embed.skin') {
			const mediaId = movie.imdbId || movie.tmdbId;
			if (mediaType === 'movie') return `https://2embed.skin/embed/movie/${mediaId}`;
			return `https://2embed.skin/embed/tv/${mediaId}/${selectedSeason}/${selectedEpisode}`;
		}

		if (providerId === 'vidlink') {
			if (mediaType === 'tv') {
				return `https://vidlink.pro/tv/${movie.tmdbId}/${selectedSeason}/${selectedEpisode}?${customParams}`;
			}
			return `https://vidlink.pro/movie/${movie.tmdbId}?${customParams}`;
		}

		if (providerId === 'vidsrc') {
			const path = mediaType === 'movie'
				? `embed/movie/${movie.tmdbId}`
				: `embed/tv/${movie.tmdbId}/${selectedSeason}/${selectedEpisode}`;
			return `/api/stream-proxy/vidsrc/${path}`;
		}

		if (providerId === '2embed') {
			const mediaId = movie.imdbId || movie.tmdbId;
			const embedBase = 'https://hnembed.cc';
			if (mediaType === 'movie') return `${embedBase}/embed/movie/${mediaId}`;
			if (mediaType === 'tv') return `${embedBase}/embed/tv/${mediaId}/${selectedSeason}/${selectedEpisode}`;
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

	function buildProviderList(): Provider[] {
		const list: Provider[] = [];
		for (const p of EMBED_PROVIDERS) {
			const url = buildDirectEmbedUrl(p.id);
			if (url) {
				list.push({
					id: p.id,
					name: p.label,
					type: 'iframe',
					working: null
				});
			}
		}
		return list;
	}

	function handleProviderSelect(e: CustomEvent<{ providerId: string; season: number; episode: number }>) {
		const { providerId, season, episode } = e.detail;
		loadProvider(providerId, season, episode);
	}

	function handleProviderTest(e: CustomEvent<{
		providerId: string;
		season: number;
		episode: number;
		callback: (working: boolean) => void;
	}>) {
		const { providerId, season, episode, callback } = e.detail;
		testProvider(providerId, season, episode, callback);
	}

	async function loadProvider(providerId: string, season: number, episode: number) {
		if (!movie?.tmdbId) return;

		const embedUrl = buildDirectEmbedUrl(providerId);
		if (embedUrl) {
			activeEmbedUrl = embedUrl;
			showProviderSelector = false;
			startProgressTracking();
		}
	}

	async function testProvider(
		providerId: string,
		season: number,
		episode: number,
		callback: (working: boolean) => void
	) {
		const embedUrl = buildDirectEmbedUrl(providerId);
		if (!embedUrl) {
			callback(false);
			return;
		}

		const start = performance.now();
		const { testWithFallback } = await import('$lib/streaming/iframeProbe');
		const { providerScoring } = await import('$lib/streaming/provider-scoring');
		const result = await testWithFallback(embedUrl);
		if (result.works) {
			providerScoring.recordSuccess(providerId, performance.now() - start);
			callback(true);
		} else {
			providerScoring.recordFailure(providerId);
			callback(false);
		}
	}

	async function handlePlayClick() {
		providers = buildProviderList();
		if (providers.length === 0) return;

		if (!movie?.tmdbId) return;

		serverScanning = true;
		serverResults = SORTED_PROVIDERS.map((p) => ({
			provider: p,
			url: '',
			status: 'checking' as const
		}));

		try {
			const params: ProviderParams = {
				tmdbId: movie.tmdbId,
				type: mediaType,
				season: mediaType !== 'movie' ? selectedSeason : undefined,
				episode: mediaType !== 'movie' ? selectedEpisode : undefined,
				imdbId: movie.imdbId ?? null
			};

			let autoPlayed = false;
			const { results, firstUp } = await scanAllProviders(params, (updated) => {
				serverResults = updated;
				if (!autoPlayed) {
					const found = updated.find((r) => r.status === 'up');
					if (found) {
						autoPlayed = true;
						activeProviderId = found.provider.id;
						activeEmbedUrl = found.url;
						showProviderSelector = false;
						startProgressTracking();
					}
				}
			});

			serverResults = results;
			serverScanning = false;

			if (!autoPlayed && firstUp) {
				activeProviderId = firstUp.provider.id;
				activeEmbedUrl = firstUp.url;
				showProviderSelector = false;
				startProgressTracking();
			}

			if (!activeEmbedUrl) {
				showProviderSelector = true;
			}
		} catch {
			serverScanning = false;
			showProviderSelector = true;
		}
	}

	function handleServerSelect(result: ProbeResult) {
		if (result.status !== 'up') return;
		activeProviderId = result.provider.id;
		activeEmbedUrl = result.url;
		showProviderSelector = false;
		startProgressTracking();
	}

	function startProgressTracking() {
		if (movie?.durationMinutes) {
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

			if (mediaType !== 'movie') {
				playerService.setupAutoPlayTimer(movie.durationMinutes, () => {
					goToNextEpisode();
				});
			}
		}
	}

	let autoNextCountdown = $state(30);
	let autoNextTimer: ReturnType<typeof setInterval> | null = null;

	function cancelAutoNext() {
		playerService.cancelAutoPlay();
		if (autoNextTimer) {
			clearInterval(autoNextTimer);
			autoNextTimer = null;
		}
	}

	function onNextOverlayShown() {
		autoNextCountdown = 30;
		if (autoNextTimer) clearInterval(autoNextTimer);
		autoNextTimer = setInterval(() => {
			autoNextCountdown--;
			if (autoNextCountdown <= 0 && autoNextTimer) {
				clearInterval(autoNextTimer);
				autoNextTimer = null;
			}
		}, 1000);
	}

	$effect(() => {
		if (playerService.showNextOverlay) {
			onNextOverlayShown();
		} else {
			if (autoNextTimer) {
				clearInterval(autoNextTimer);
				autoNextTimer = null;
			}
		}
	});

	function closePlayer(reason?: 'error' | 'user') {
		if (reason === 'error') {
			triggerAutoSwitch();
			return;
		}
		activeEmbedUrl = null;
		isAutoSwitching = false;
		autoSwitchLabel = '';
		playerService.stopProgressTracking();
	}

	async function triggerAutoSwitch() {
		if (isAutoSwitching) return;
		isAutoSwitching = true;
		const total = fallbackQueue.length + 1;
		const tried = EMBED_PROVIDERS.length - fallbackQueue.length;
		autoSwitchLabel = `Source failed — trying ${tried + 1}/${total}...`;

		if (fallbackQueue.length > 0) {
			const nextProvider = fallbackQueue.shift()!;
			currentFallbackProvider = nextProvider;
			const embedUrl = tryPlayWithFallback(nextProvider);
			if (embedUrl) {
				activeEmbedUrl = embedUrl;
				isAutoSwitching = false;
				autoSwitchLabel = '';
				startProgressTracking();
				return;
			}
			triggerAutoSwitch();
		} else {
			isAutoSwitching = false;
			autoSwitchLabel = '';
			activeEmbedUrl = null;
			streamingService.state.error = 'No working stream found.';
			playerService.stopProgressTracking();
		}
	}

	async function handleHeaderPlay(providerId: string) {
		console.log('[PLAY] handleHeaderPlay called with provider:', providerId, 'tmdbId:', movie?.tmdbId, 'mediaType:', mediaType);

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

		if (!currentFallbackProvider) {
			fallbackQueue = EMBED_PROVIDERS.map((p) => p.id).filter((id) => id !== providerId);
		}
		currentFallbackProvider = providerId;

		const embedUrl = tryPlayWithFallback(providerId);
		if (embedUrl) {
			console.log('[PLAY] Using embed URL for provider:', providerId, embedUrl);
			activeEmbedUrl = embedUrl;
			startProgressTracking();
			return;
		}

		const playbackUrl =
			streamingService.state.source?.embedUrl ?? streamingService.state.source?.streamUrl ?? null;
		if (playbackUrl) {
			console.log('[PLAY] Using resolved stream URL:', playbackUrl);
			activeEmbedUrl = playbackUrl;
			startProgressTracking();
			return;
		}

		if (fallbackQueue.length > 0) {
			const nextProvider = fallbackQueue.shift()!;
			console.log('[PLAY] No stream from', providerId, ', trying next:', nextProvider);
			currentFallbackProvider = nextProvider;
			handleHeaderPlay(nextProvider);
			return;
		}

		console.error('[PLAY] All providers failed');
		streamingService.state.error = 'No working stream found. Please try a different provider.';
	}

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
				case '?':
					event.preventDefault();
					showShortcutsHelp = !showShortcutsHelp;
					break;
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
		mediaType === 'tv' ? 'Series Not Found' : 'Movie Not Found'
	);
	const notFoundDescription = $derived(
		mediaType === 'tv'
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
		ogType={mediaType === 'tv' ? 'video.tv_show' : 'video.movie'}
		ogImage={ogImage ?? undefined}
		ogImageAlt={`${movie.title} poster`}
		twitterCard="summary_large_image"
		keywords={[
			movie.title,
			...(movie.genres?.map((g: MediaGenre) => g.name) || []),
			mediaType === 'tv' ? 'TV show' : 'movie',
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
				onplay={handlePlayClick}
			/>

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
						{#if mediaType === 'tv' && movie.seasons}
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

						{#if data.watchProviders && (data.watchProviders.flatrate.length > 0 || data.watchProviders.rent.length > 0 || data.watchProviders.buy.length > 0)}
							<div class="mb-8 px-[10%]">
								{#if data.watchProviders.flatrate.length > 0}
									<h3 class="mb-3 text-lg font-bold text-foreground">Streaming on</h3>
									<div class="flex flex-wrap gap-3">
										{#each data.watchProviders.flatrate as provider}
											<div class="flex items-center gap-2 rounded-lg bg-muted/60 px-3 py-2 backdrop-blur-sm">
												<img
													src={provider.logo_path ? `https://image.tmdb.org/t/p/w45${provider.logo_path}` : ''}
													alt={provider.provider_name}
													title={provider.provider_name}
													class="size-8 rounded object-contain"
													loading="lazy"
												/>
												<span class="text-sm font-medium text-foreground">{provider.provider_name}</span>
											</div>
										{/each}
									</div>
								{/if}
								{#if data.watchProviders.rent.length > 0 || data.watchProviders.buy.length > 0}
									<div class="mt-4 flex flex-wrap gap-3">
										{#if data.watchProviders.rent.length > 0}
											{#each data.watchProviders.rent as provider}
												<div class="flex items-center gap-2 rounded-lg bg-muted/30 px-3 py-2 backdrop-blur-sm opacity-60">
													<img
														src={provider.logo_path ? `https://image.tmdb.org/t/p/w45${provider.logo_path}` : ''}
														alt={provider.provider_name}
														title={'Rent on ' + provider.provider_name}
														class="size-6 rounded object-contain"
														loading="lazy"
													/>
													<span class="text-xs text-muted-foreground">Rent</span>
												</div>
											{/each}
										{/if}
										{#if data.watchProviders.buy.length > 0}
											{#each data.watchProviders.buy as provider}
												<div class="flex items-center gap-2 rounded-lg bg-muted/30 px-3 py-2 backdrop-blur-sm opacity-60">
													<img
														src={provider.logo_path ? `https://image.tmdb.org/t/p/w45${provider.logo_path}` : ''}
														alt={provider.provider_name}
														title={'Buy on ' + provider.provider_name}
														class="size-6 rounded object-contain"
														loading="lazy"
													/>
													<span class="text-xs text-muted-foreground">Buy</span>
												</div>
											{/each}
										{/if}
									</div>
								{/if}
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
								<div class="flex gap-3 pt-2">
									<button
										class="inline-flex items-center gap-2 rounded-lg bg-muted/60 px-4 py-2 text-sm font-medium text-foreground transition hover:bg-muted/80"
										onclick={() => {
											const key = `${mediaType}:${movie.id}`;
											playbackStore.saveProgress({
												mediaId: movie.id,
												mediaType,
												progress: Number.MAX_SAFE_INTEGER,
												duration: movie.durationMinutes ? movie.durationMinutes * 60 : 3600,
												updatedAt: Date.now(),
												mediaData: { ...movie, mediaType } as LibraryMedia
											});
										}}
									>
										<svg class="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
										Mark as Watched
									</button>
								</div>
							</div>
						</section>
					</div>
				{/if}
			</div>
		</main>
	</div>

	<!-- Player Container -->
	{#if activeEmbedUrl}
		<div class="player-overlay fixed inset-0 z-50 flex flex-col bg-black/95 backdrop-blur-sm">
			<!-- Top bar -->
			<div class="relative flex shrink-0 items-center justify-between px-4 py-2">
				<div class="flex items-center gap-2">
					{#if isAutoSwitching}
						<span class="rounded-lg bg-yellow-500/90 px-3 py-1 text-xs font-semibold text-yellow-900">
							{autoSwitchLabel || 'Switching source...'}
						</span>
					{/if}
				</div>
				<div class="flex gap-2">
					<button
						class="rounded-full bg-black/60 p-2 text-white hover:bg-black/80 transition"
						onclick={() => (showShortcutsHelp = !showShortcutsHelp)}
						title="Keyboard shortcuts (?)"
					>
						<svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
					</button>
					<button
						class="rounded-full bg-black/60 p-2 text-white hover:bg-black/80 transition"
						onclick={() => closePlayer('user')}
					>
						<svg class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
						</svg>
					</button>
				</div>
			</div>

			<!-- Player -->
			<div class="shrink-0" style="height: min(60vh, 600px);">
				<InlinePlayer src={activeEmbedUrl} title={movie?.title ?? 'Player'} onClose={closePlayer} compact />
			</div>

			<!-- Overlays -->
			{#if showShortcutsHelp}
				<div class="absolute inset-0 z-30 flex items-start justify-center pt-20">
					<div class="w-full max-w-md rounded-xl bg-black/85 p-6 shadow-2xl backdrop-blur-md mx-4">
						<div class="mb-4 flex items-center justify-between">
							<h3 class="text-lg font-bold text-white">Keyboard Shortcuts</h3>
							<button class="text-white/50 hover:text-white" onclick={() => (showShortcutsHelp = false)}>
								<svg class="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg>
							</button>
						</div>
						<div class="space-y-2 text-sm">
							<div class="flex justify-between"><span class="text-white/60">N</span><span class="text-white">Next episode</span></div>
							<div class="flex justify-between"><span class="text-white/60">P</span><span class="text-white">Previous episode</span></div>
							<div class="flex justify-between"><span class="text-white/60">+ / -</span><span class="text-white">Adjust playback speed</span></div>
							<div class="flex justify-between"><span class="text-white/60">?</span><span class="text-white">Toggle this help</span></div>
							<div class="flex justify-between"><span class="text-white/60">Esc</span><span class="text-white">Close player / help</span></div>
						</div>
						<p class="mt-4 text-xs text-white/40">Shortcuts work while the player is active.</p>
					</div>
				</div>
			{/if}
			{#if playerService.showNextOverlay && mediaType !== 'movie'}
				<div class="absolute bottom-40 left-1/2 z-20 -translate-x-1/2">
					<div class="flex flex-col items-center gap-3 rounded-xl bg-black/80 px-6 py-4 shadow-lg backdrop-blur-md">
						<p class="text-sm text-white/70">Next episode starting in <span class="font-bold text-white">{autoNextCountdown}</span>s</p>
						<div class="flex gap-3">
							<button class="rounded-lg bg-white/20 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/30" onclick={cancelAutoNext}>Cancel</button>
							<button class="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-500" onclick={() => { cancelAutoNext(); goToNextEpisode(); }}>Play Now</button>
						</div>
					</div>
				</div>
			{/if}

			<!-- Server Grid (scrollable) -->
			<div class="flex-1 overflow-y-auto px-4 pb-6">
				<ServerGrid
					results={serverResults}
					activeProviderId={activeProviderId}
					scanning={serverScanning}
					onselect={handleServerSelect}
				/>
			</div>
		</div>
	{/if}

	<!-- Provider Selector Modal -->
	<ProviderSelector
		bind:open={showProviderSelector}
		{providers}
		isTv={mediaType !== 'movie'}
		season={selectedSeason}
		episode={selectedEpisode}
		onselect={handleProviderSelect}
		ontestProvider={handleProviderTest}
		onclose={() => (showProviderSelector = false)}
	/>
{/if}
