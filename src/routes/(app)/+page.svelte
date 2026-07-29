<script lang="ts">
import Hero from '$lib/components/home/Hero.svelte';
import { PersonalizedRows } from '$lib/components/home';
import { MediaScrollContainer } from '$lib/components/media';
import HomePageSkeleton from '$lib/components/skeletons/HomePageSkeleton.svelte';
import type { PageData } from './$types';
import type { HomeLibrary } from '$lib/types/library';
import { SEOHead } from '$lib/components/seo';
import { useLazyComponentOnVisible } from '$lib/utils/lazyLoad.svelte';
import { Button } from '$lib/components/ui/button';
import { ErrorState } from '$lib/components/ui';
import { Loader2, RefreshCw } from '@lucide/svelte';
import DiscoveryEngine from '$lib/components/DiscoveryEngine.svelte';
import ContentCalendar from '$lib/components/ContentCalendar.svelte';

	let continueWatchingRef = $state({ value: null as HTMLElement | null });
	let trendingMediaRef = $state({ value: null as HTMLElement | null });
	let trendingTvRef = $state({ value: null as HTMLElement | null });
	let recentlyAddedRef = $state({ value: null as HTMLElement | null });
	let topRatedRef = $state({ value: null as HTMLElement | null });

	const continueWatchingLazy = useLazyComponentOnVisible(
		continueWatchingRef,
		() => import('$lib/components/home/ContinueWatchingRow.svelte')
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

	const ContinueWatchingRow = $derived(continueWatchingLazy.component);
	const TrendingMediaSlider = $derived(trendingLazy.component);
	const RecentlyAddedRow = $derived(recentlyAddedLazy.component);
	const TopRatedRow = $derived(topRatedLazy.component);

	let { data }: { data: PageData } = $props();

	let isRefreshing = $state(false);
	let refreshError = $state<string | null>(null);

	let homeLibraryPromise = $derived(
		data.streamed?.homeLibrary as Promise<HomeLibrary | null> ?? null
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

<!-- Hero section -->
<section class="hero">
	<div class="hero-bg">
		<div class="hero-gradient"></div>
	</div>
	<div class="hero-content container fade-in-up">
		<span class="hero-badge">✦ New & Trending</span>
		<h1 class="hero-title">Stream Without<br />Limits</h1>
		<p class="hero-subtitle">
			Movies, TV series, and Afrikaans content — ad-free,
			buffer-free, hassle-free.
		</p>
		<div class="hero-actions">
			<a href="/movies" class="hero-btn hero-btn-primary">
				▶ Browse Movies
			</a>
			<a href="/tv" class="hero-btn hero-btn-secondary">
				TV Series →
			</a>
		</div>
	</div>
</section>

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

						<div class="flex flex-wrap items-center gap-3 px-[5%] pb-6 text-sm text-muted-foreground sm:px-5">
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
									<div
										bind:this={continueWatchingRef.value}
										class="h-32 animate-pulse rounded-lg bg-muted/50"
									></div>
								{/if}
								<PersonalizedRows />
							</div>

							{#if trendingMovies.length > 0}
								{#if TrendingMediaSlider}
									<TrendingMediaSlider title="Trending Movies" movies={trendingMovies} />
								{:else}
									<div
										bind:this={trendingMediaRef.value}
										class="h-48 animate-pulse rounded-lg bg-muted/50"
									></div>
								{/if}
							{/if}

							{#if trendingTv.length > 0}
								{#if TrendingMediaSlider}
									<TrendingMediaSlider title="Trending TV Series" movies={trendingTv} />
								{:else}
									<div
										bind:this={trendingTvRef.value}
										class="h-48 animate-pulse rounded-lg bg-muted/50"
									></div>
								{/if}
							{/if}

							{#if RecentlyAddedRow}
								<RecentlyAddedRow />
							{:else}
								<div
									bind:this={recentlyAddedRef.value}
									class="h-48 animate-pulse rounded-lg bg-muted/50"
								></div>
							{/if}

							{#if TopRatedRow}
								<TopRatedRow />
							{:else}
								<div
									bind:this={topRatedRef.value}
									class="h-48 animate-pulse rounded-lg bg-muted/50"
								></div>
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
	.hero {
		position: relative;
		min-height: 480px;
		display: flex;
		align-items: center;
		overflow: hidden;
	}

	.hero-bg {
		position: absolute;
		inset: 0;
	}

	.hero-gradient {
		position: absolute;
		inset: 0;
		background:
			radial-gradient(ellipse 80% 60% at 30% 20%, rgba(124, 92, 252, 0.12) 0%, transparent 60%),
			radial-gradient(ellipse 60% 50% at 70% 60%, rgba(201, 75, 140, 0.08) 0%, transparent 60%),
			linear-gradient(180deg, transparent 0%, var(--bg-root) 100%);
	}

	.hero-content {
		position: relative;
		z-index: 1;
		padding: 4rem 0;
		text-align: center;
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

	@media (max-width: 600px) {
		.hero {
			min-height: 380px;
		}

		.hero-content {
			padding: 2rem 0;
		}
	}
</style>
