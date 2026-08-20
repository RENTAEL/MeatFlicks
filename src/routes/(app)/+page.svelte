<script lang="ts">
	import Hero from '$lib/components/home/Hero.svelte';
	import { PersonalizedRows } from '$lib/components/home';
	import { MediaScrollContainer } from '$lib/components/media';
	import HomePageSkeleton from '$lib/components/skeletons/HomePageSkeleton.svelte';
	import MediaRowSkeleton from '$lib/components/skeletons/MediaRowSkeleton.svelte';
	import type { PageData } from './$types';
	import type { HomeLibrary } from '$lib/types/library';
	import { SEOHead } from '$lib/components/seo';
	import { useLazyComponentOnVisible } from '$lib/utils/lazyLoad.svelte';
	import { Button } from '$lib/components/ui/button';
	import { ErrorState } from '$lib/components/ui';
	import { Loader2, Quote, RefreshCw } from '@lucide/svelte';
	import DiscoveryEngine from '$lib/components/DiscoveryEngine.svelte';
	import ContentCalendar from '$lib/components/ContentCalendar.svelte';
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';
	import { getImageUrl, getBackdropSrcSet } from '$lib/utils/image';
	import { getScrollY, addScrollListener } from '$lib/utils/scrollPosition';

	const WP_CODE_RE = /^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{6}$/;
	let wpCode = $state('');

	function joinWatchParty() {
		const clean = wpCode.trim().toUpperCase();
		if (!WP_CODE_RE.test(clean)) return;
		goto(`/watch/${clean}`);
	}

	// Daily Quotes — the section is a dynamic import, loaded only on first
	// open so it never touches the initial bundle or first paint.
	type DQModule = typeof import('$lib/components/home/DailyQuoteSection.svelte');
	let dqOpen = $state(false);
	let DQSection = $state<DQModule['default'] | null>(null);
	let dqLoading = $state(false);
	let flags = $state<Record<string, boolean>>({});

	onMount(() => {
		void fetch('/api/feature-flags')
			.then((r) => (r.ok ? r.json() : null))
			.then((data) => {
				if (data?.flags) flags = data.flags;
			})
			.catch(() => {});
	});

	async function openDailyQuotes() {
		if (dqOpen) return;
		dqOpen = true;
		if (!DQSection) {
			dqLoading = true;
			try {
				DQSection = (await import('$lib/components/home/DailyQuoteSection.svelte')).default;
			} finally {
				dqLoading = false;
			}
		}
	}

	let continueWatchingRef = $state({ value: null as HTMLElement | null });
	let recommendedRef = $state({ value: null as HTMLElement | null });
	let trendingMediaRef = $state({ value: null as HTMLElement | null });
	let trendingTvRef = $state({ value: null as HTMLElement | null });
	let recentlyAddedRef = $state({ value: null as HTMLElement | null });
	let topRatedRef = $state({ value: null as HTMLElement | null });

	const continueWatchingLazy = useLazyComponentOnVisible(
		continueWatchingRef,
		() => import('$lib/components/home/ContinueWatchingRow.svelte')
	);

	const recommendedLazy = useLazyComponentOnVisible(
		recommendedRef,
		() => import('$lib/components/home/RecommendedRow.svelte')
	);

	const trendingLazy = useLazyComponentOnVisible(
		trendingMediaRef,
		() => import('$lib/components/home/TrendingMediaSlider.svelte')
	);

	const recentlyAddedLazy = useLazyComponentOnVisible(
		recentlyAddedRef,
		() => import('$lib/components/home/RecentlyAddedRow.svelte')
	);

	const topRatedLazy = useLazyComponentOnVisible(
		topRatedRef,
		() => import('$lib/components/home/TopRatedRow.svelte')
	);

	const RecommendedRow = $derived(recommendedLazy.component);
	const ContinueWatchingRow = $derived(continueWatchingLazy.component);
	const TrendingMediaSlider = $derived(trendingLazy.component);
	const RecentlyAddedRow = $derived(recentlyAddedLazy.component);
	const TopRatedRow = $derived(topRatedLazy.component);

	let { data }: { data: PageData } = $props();

	let isRefreshing = $state(false);
	let refreshError = $state<string | null>(null);

	let homeLibraryPromise = $derived(
		(data.streamed?.homeLibrary as Promise<HomeLibrary | null>) ?? null
	);

	async function refreshHomeLibrary() {
		if (isRefreshing) return;
		isRefreshing = true;
		refreshError = null;

		try {
			const response = await fetch('/api/home-library/refresh', { method: 'POST' });
			if (!response.ok) {
				const message = await response.text();
				throw new Error(message || 'Unable to refresh spotlight.');
			}

			const payload = (await response.json()) as {
				success: boolean;
				data: HomeLibrary | null;
				error?: string;
			};
			if (!payload.success || !payload.data) {
				throw new Error(payload.error ?? 'No spotlight data returned.');
			}
		} catch (error) {
			console.error('Failed to refresh home library data', error);
			refreshError = error instanceof Error ? error.message : 'Failed to refresh spotlight.';
		} finally {
			isRefreshing = false;
		}
	}

	// Hero collapse on scroll
	let heroCollapsed = $state(false);
	let heroElement = $state<HTMLElement | null>(null);
	let reducedMotion = false;

	onMount(() => {
		if (typeof window !== 'undefined') {
			reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
		}
	});

	function onHeroScroll() {
		if (reducedMotion || !heroElement) return;
		const scrollY = getScrollY();
		const heroHeight = heroElement.offsetHeight;
		heroCollapsed = scrollY > heroHeight * 0.3;
	}

	$effect(() => {
		return addScrollListener(onHeroScroll);
	});
</script>

<SEOHead
	title="Streamium — Premium Streaming"
	description="Movies, TV series, and Afrikaans content — ad-free, buffer-free, hassle-free."
	canonical="/"
	ogType="website"
	keywords={[
		'free movies',
		'free TV shows',
		'streaming',
		'watch online',
		'movies online',
		'TV series',
		'entertainment'
	]}
/>

<!-- Hero section - Full bleed with collapse on scroll -->
<section
	class="hero-section"
	class:collapsed={heroCollapsed}
	bind:this={heroElement}
	aria-labelledby="hero-title"
>
	<div class="hero-bg">
		{#await homeLibraryPromise then resolved}
			{#if resolved?.trendingMovies?.[0]?.backdropPath}
				{@const backdropPath = resolved.trendingMovies[0].backdropPath}
				{@const src = getImageUrl(backdropPath, 'w1280')}
				{@const srcset = getBackdropSrcSet(backdropPath)}
				<img
					{src}
					{srcset}
					sizes="100vw"
					width="1280"
					height="720"
					alt=""
					loading="eager"
					fetchpriority="high"
					aria-hidden="true"
					class="hero-image"
				/>
			{/if}
		{/await}
		<div class="hero-gradient"></div>
		<div class="hero-scrim"></div>
	</div>

	<div class="hero-content container" id="hero-content">
		<span class="hero-badge">✦ New & Trending</span>
		<h1 id="hero-title" class="hero-title">Stream Without<br />Limits</h1>
		<p class="hero-subtitle">
			Movies, TV series, and Afrikaans content — ad-free, buffer-free, hassle-free.
		</p>
		<div class="hero-actions">
			<a href="/movies" class="hero-btn hero-btn-primary" data-sveltekit-preload-data="hover">
				▶ Browse Movies
			</a>
			<a href="/tv" class="hero-btn hero-btn-secondary" data-sveltekit-preload-data="hover">
				TV Series →
			</a>
		</div>
	</div>
</section>

{#if flags.watchPartyEnabled ?? true}
	<section class="wp-strip">
		<div class="wp-strip-inner">
			<div class="wp-strip-text">
				<span class="wp-strip-title">Watch Party</span>
				<span class="wp-strip-sub">Got a room code? Jump straight in.</span>
			</div>
			<form
				class="wp-strip-form"
				onsubmit={(e) => {
					e.preventDefault();
					joinWatchParty();
				}}
			>
				<input
					class="wp-strip-input"
					value={wpCode}
					oninput={(e) => (wpCode = (e.currentTarget as HTMLInputElement).value.toUpperCase())}
					placeholder="Room code"
					maxlength="6"
					aria-label="Watch party room code"
				/>
				<button
					class="wp-strip-btn"
					type="submit"
					disabled={!WP_CODE_RE.test(wpCode.trim().toUpperCase())}
				>
					Join
				</button>
			</form>
			<a class="wp-strip-link" href="/watch-party">Start one →</a>
			{#if flags.dqEnabled ?? true}
				<button
					class="dq-chip"
					type="button"
					onclick={openDailyQuotes}
					disabled={dqLoading}
					aria-label="Daily Quotes"
					title="Daily Quotes"
				>
					<Quote size={14} aria-hidden="true" />
					<span>DQ</span>
				</button>
			{/if}
		</div>
	</section>
{/if}

{#if dqOpen && DQSection}
	<DQSection onclose={() => (dqOpen = false)} />
{/if}

<div class="page-transition min-h-screen text-foreground">
	<div class="mx-auto w-full py-2 pr-2 pl-0 sm:pr-2 sm:pl-0 lg:pr-2 lg:pl-0">
		<main class="flex min-h-[calc(100vh-2rem)] flex-col gap-12 rounded-2xl glass shadow-xl">
			{#if homeLibraryPromise}
				{#await homeLibraryPromise}
					<HomePageSkeleton />
				{:then resolved}
					{#if !resolved}
						<HomePageSkeleton />
					{:else}
						{@const library = resolved}
						{@const trendingMovies = Array.isArray(library?.trendingMovies)
							? library.trendingMovies
							: []}
						{@const trendingTv = Array.isArray(library?.trendingTv) ? library.trendingTv : []}
						{@const collections = Array.isArray(library?.collections) ? library.collections : []}
						{@const genres = Array.isArray(library?.genres) ? library.genres : []}
						{@const featuredItem = trendingMovies.at(0) ?? null}

						<Hero movie={featuredItem} movies={trendingMovies} />

						<div
							class="flex flex-wrap items-center gap-3 px-[5%] pb-6 text-sm text-muted-foreground sm:px-5"
						>
							<Button
								type="button"
								variant="outline"
								class="gap-2"
								onclick={refreshHomeLibrary}
								disabled={isRefreshing}
								aria-live="polite"
								aria-busy={isRefreshing}
							>
								{#if isRefreshing}
									<Loader2 class="h-4 w-4 animate-spin" aria-hidden="true" />
								{:else}
									<RefreshCw class="h-4 w-4" aria-hidden="true" />
								{/if}
								Refresh library
							</Button>
							<p class="text-xs text-foreground/70">
								{isRefreshing
									? 'Refreshing curated selections…'
									: 'Tap refresh for the latest spotlight without reloading.'}
							</p>
						</div>

						{#if refreshError}
							<p class="px-[5%] text-sm text-destructive sm:px-5">{refreshError}</p>
						{/if}

						<div class="p-6 sm:p-5 lg:p-5">
							<div class="mb-12">
								{#if ContinueWatchingRow}
									<ContinueWatchingRow />
								{:else}
									<div bind:this={continueWatchingRef.value} class="w-full">
										<MediaRowSkeleton variant="wide" items={4} />
									</div>
								{/if}
								<PersonalizedRows />
							</div>

							<div class="mb-12">
								{#if RecommendedRow}
									<RecommendedRow />
								{:else}
									<div bind:this={recommendedRef.value} class="w-full">
										<MediaRowSkeleton variant="wide" items={4} />
									</div>
								{/if}
							</div>

							{#if trendingMovies.length > 0}
								{#if TrendingMediaSlider}
									<TrendingMediaSlider title="New Releases" movies={trendingMovies} />
								{:else}
									<div bind:this={trendingMediaRef.value} class="w-full">
										<MediaRowSkeleton />
									</div>
								{/if}
							{/if}

							{#if trendingTv.length > 0}
								{#if TrendingMediaSlider}
									<TrendingMediaSlider title="New TV Series" movies={trendingTv} />
								{:else}
									<div bind:this={trendingTvRef.value} class="w-full">
										<MediaRowSkeleton />
									</div>
								{/if}
							{/if}

							{#if RecentlyAddedRow}
								<RecentlyAddedRow />
							{:else}
								<div bind:this={recentlyAddedRef.value} class="w-full">
									<MediaRowSkeleton />
								</div>
							{/if}

							{#if TopRatedRow}
								<TopRatedRow />
							{:else}
								<div bind:this={topRatedRef.value} class="w-full">
									<MediaRowSkeleton />
								</div>
							{/if}

							{#if trendingMovies.length === 0 && collections.length === 0 && genres.length === 0}
								<p class="text-sm text-foreground/70">
									No media available yet. Try refreshing the library.
								</p>
							{/if}

							{#each collections as collection (collection.id)}
								{#if Array.isArray(collection.media) && collection.media.length > 0}
									<MediaScrollContainer
										title={collection.name}
										media={collection.media}
										linkTo={`/collection/${collection.slug}`}
									/>
								{/if}
							{/each}

							{#each genres as genre (genre.id)}
								{#if Array.isArray(genre.media) && genre.media.length > 0}
									<MediaScrollContainer
										title={genre.name}
										media={genre.media}
										linkTo={`/genre/${genre.slug}`}
									/>
								{/if}
							{/each}

							{#await data.streamed?.afrikaans}
								<MediaRowSkeleton />
							{:then afrikaansPicks}
								{#if afrikaansPicks && afrikaansPicks.length >= 4}
									<MediaScrollContainer
										title="Afrikaans Flieks"
										media={afrikaansPicks}
										linkTo="/afrikaans"
									/>
								{/if}
							{/await}

							<DiscoveryEngine />
							<ContentCalendar />
						</div>
					{/if}
				{:catch}
					<HomePageSkeleton />
				{/await}
			{:else}
				<HomePageSkeleton />
			{/if}
		</main>
	</div>
</div>

<style>
	.hero-section {
		position: relative;
		min-height: 480px;
		display: flex;
		align-items: center;
		overflow: hidden;
		transition: min-height 0.4s cubic-bezier(0.4, 0, 0.2, 1);
	}

	.hero-section.collapsed {
		min-height: 240px;
	}

	.hero-bg {
		position: absolute;
		inset: 0;
		overflow: hidden;
	}

	.hero-image {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		object-fit: cover;
		object-position: center 30%;
		transform: scale(1.02);
		transition: transform 0.6s cubic-bezier(0.4, 0, 0.2, 1);
		will-change: transform;
	}

	.hero-section.collapsed .hero-image {
		transform: scale(1.1) translateY(-8%);
	}

	.hero-gradient {
		position: absolute;
		inset: 0;
		background:
			radial-gradient(ellipse 80% 60% at 30% 20%, rgba(124, 92, 252, 0.12) 0%, transparent 60%),
			radial-gradient(ellipse 60% 50% at 70% 60%, rgba(201, 75, 140, 0.08) 0%, transparent 60%);
	}

	.hero-scrim {
		position: absolute;
		inset: 0;
		background: linear-gradient(
			180deg,
			rgba(10, 10, 15, 0.25) 0%,
			rgba(10, 10, 15, 0.55) 55%,
			var(--bg-root) 100%
		);
	}

	.hero-content {
		position: relative;
		z-index: 1;
		padding: 4rem 0 3.5rem;
		text-align: center;
		transition: padding 0.4s cubic-bezier(0.4, 0, 0.2, 1);
	}

	.hero-section.collapsed .hero-content {
		padding: 2.5rem 0 2rem;
	}

	.hero-badge {
		display: inline-block;
		padding: 0.35rem 1rem;
		border-radius: var(--radius-full);
		background: var(--accent-soft);
		color: var(--accent-stream);
		font-size: 0.85rem;
		font-weight: var(--font-weight-semibold);
		margin-bottom: 1.5rem;
		border: 1px solid rgba(124, 92, 252, 0.2);
	}

	.hero-title {
		font-size: clamp(2.5rem, 6vw, 4rem);
		font-weight: var(--font-weight-black);
		line-height: 1.1;
		letter-spacing: -0.03em;
		margin-bottom: 1rem;
		background: linear-gradient(180deg, #ffffff 0%, #c0c0d0 100%);
		-webkit-background-clip: text;
		-webkit-text-fill-color: transparent;
		background-clip: text;
	}

	.hero-subtitle {
		font-size: 1.1rem;
		color: var(--text-secondary);
		max-width: 500px;
		margin: 0 auto 2rem;
		line-height: 1.7;
	}

	.hero-actions {
		display: flex;
		gap: 1rem;
		justify-content: center;
		flex-wrap: wrap;
	}

	.hero-btn {
		padding: 0.75rem 1.75rem;
		border-radius: var(--radius-full);
		font-size: 1rem;
		font-weight: var(--font-weight-semibold);
		transition: all var(--transition-base);
	}

	.hero-btn-primary {
		background: var(--gradient-brand);
		color: white;
		box-shadow: 0 4px 20px var(--accent-glow);
	}

	.hero-btn-primary:hover {
		transform: translateY(-2px);
		box-shadow: 0 8px 30px var(--accent-glow);
	}

	.hero-btn-secondary {
		color: var(--text-primary);
		border: 1px solid var(--border-strong);
		background: var(--glass-bg);
		backdrop-filter: blur(8px);
	}

	.hero-btn-secondary:hover {
		background: var(--bg-card);
		border-color: var(--border-strong);
	}

	@media (prefers-reduced-motion: reduce) {
		.hero-section,
		.hero-image,
		.hero-content {
			transition: none;
		}
	}

	@media (max-width: 600px) {
		.hero-section {
			min-height: 380px;
		}

		.hero-section.collapsed {
			min-height: 200px;
		}

		.hero-content {
			padding: 2rem 0 2.5rem;
		}
	}

	.wp-strip {
		max-width: 1100px;
		margin: -1rem auto 0;
		padding: 0 1.5rem;
	}

	.wp-strip-inner {
		display: flex;
		align-items: center;
		gap: 1.25rem;
		flex-wrap: wrap;
		padding: 1rem 1.25rem;
		border-radius: var(--radius-xl);
		background: var(--bg-card);
		border: 1px solid var(--border-stream);
	}

	.wp-strip-text {
		display: flex;
		flex-direction: column;
		gap: 0.15rem;
		flex: 1;
		min-width: 180px;
	}

	.wp-strip-title {
		font-weight: var(--font-weight-semibold);
		color: var(--text-primary);
	}

	.wp-strip-sub {
		font-size: 0.8rem;
		color: var(--text-secondary);
	}

	.wp-strip-form {
		display: flex;
		gap: 0.5rem;
	}

	.wp-strip-input {
		width: 150px;
		padding: 0.55rem 0.75rem;
		border-radius: var(--radius-md);
		background: var(--bg-root);
		border: 1px solid var(--border-stream);
		color: var(--text-primary);
		font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
		font-size: 1rem;
		font-weight: 700;
		letter-spacing: 0.1em;
		text-align: center;
		text-transform: uppercase;
		outline: none;
	}

	.wp-strip-input:focus {
		border-color: var(--accent-color, #818cf8);
	}

	.wp-strip-btn {
		padding: 0.55rem 1.25rem;
		border-radius: var(--radius-md);
		background: var(--gradient-brand);
		color: white;
		border: none;
		font-weight: var(--font-weight-semibold);
		cursor: pointer;
	}

	.wp-strip-btn:disabled {
		opacity: 0.35;
		cursor: not-allowed;
	}

	.wp-strip-link {
		font-size: 0.85rem;
		font-weight: var(--font-weight-semibold);
		color: var(--accent-color, #818cf8);
		text-decoration: none;
		white-space: nowrap;
	}

	.wp-strip-link:hover {
		text-decoration: underline;
	}

	.dq-chip {
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
		padding: 0.45rem 0.9rem;
		border-radius: var(--radius-full);
		border: 1px solid var(--border-stream);
		background: var(--bg-card);
		color: var(--text-secondary);
		font-size: 0.8rem;
		font-weight: var(--font-weight-semibold);
		letter-spacing: 0.04em;
		cursor: pointer;
		transition:
			color 0.15s ease,
			border-color 0.15s ease,
			background 0.15s ease;
	}

	.dq-chip:hover:not(:disabled) {
		color: var(--text-primary);
		border-color: var(--accent-color, #818cf8);
		background: var(--bg-root);
	}

	.dq-chip:disabled {
		opacity: 0.6;
		cursor: default;
	}
</style>
