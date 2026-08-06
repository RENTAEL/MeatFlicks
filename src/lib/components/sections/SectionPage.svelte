<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { Search, Shuffle, Star, X } from '@lucide/svelte';
	import Hero from '$lib/components/home/Hero.svelte';
	import MediaScrollContainer from '$lib/components/media/MediaScrollContainer.svelte';
	import MediaCard from '$lib/components/media/MediaCard.svelte';
	import EmptyState from '$lib/components/media/EmptyState.svelte';
	import MediaRowSkeleton from '$lib/components/skeletons/MediaRowSkeleton.svelte';
	import { toLibraryMovie } from '$lib/utils/tmdb';
	import { Button } from '$lib/components/ui/button';
	import type { LibraryMedia } from '$lib/types/library';

	type BrowseResult = {
		results: Record<string, unknown>[];
		page: number;
		total_pages: number;
		hasMore: boolean;
	};

	type Rail = {
		id: string;
		titleAf: string;
		titleEn: string;
		items: LibraryMedia[];
	};

	type Props = {
		section: 'movies' | 'tv';
		rails: Rail[];
		hero: LibraryMedia[];
		browse: BrowseResult;
		browseParams: {
			category?: string | null;
			type?: string | null;
			genre?: string | number | null;
			decade?: string | number | null;
			sort?: string | null;
		};
		error?: string | null;
	};

	let { section, rails, hero, browse, browseParams, error = null }: Props = $props();

	const isMovies = section === 'movies';
	const sectionTitle = isMovies ? 'Flieks / Movies' : 'Reekse / TV Series';
	const sectionSub =
		isMovies
			? 'Flieks uit die biblioteek / Movies from the library'
			: 'Reekse uit die biblioteek / Series from the library';

	const CATEGORIES: { value: string; label: string }[] = [
		{ value: 'all', label: 'Alles / All' },
		{ value: 'trending', label: 'Neig / Trending' },
		{ value: 'popular', label: 'Gewild / Popular' },
		{ value: 'top_rated', label: 'Topgewaardeer / Top Rated' },
		{ value: 'upcoming', label: 'Binnekort / Upcoming' }
	];

	const TYPES: { value: string; label: string }[] = [
		{ value: 'reekse', label: 'Reekse / Series' },
		{ value: 'minireeks', label: 'Minireeks / Miniseries' },
		{ value: 'alles', label: 'Alles / All' }
	];

	const GENRES: Record<'movies' | 'tv', { value: string | null; label: string }[]> = {
		movies: [
			{ value: null, label: 'Alle genres / All genres' },
			{ value: '28', label: 'Aksie / Action' },
			{ value: '35', label: 'Komedie / Comedy' },
			{ value: '18', label: 'Drama' },
			{ value: '27', label: 'Gruwel / Horror' },
			{ value: '878', label: 'Wetenskapfiksie / Sci-Fi' },
			{ value: '99', label: 'Dokumentêr / Documentary' }
		],
		tv: [
			{ value: null, label: 'Alle genres / All genres' },
			{ value: '18', label: 'Drama' },
			{ value: '35', label: 'Komedie / Comedy' },
			{ value: '80', label: 'Misdaad / Crime' },
			{ value: '10765', label: 'Wetenskapfiksie / Sci-Fi' },
			{ value: '16', label: 'Animasiereeks / Animation' }
		]
	};

	const DECADES: Record<'movies' | 'tv', { value: string | null; label: string }[]> = {
		movies: [
			{ value: null, label: 'Alle jare / All years' },
			{ value: '2020', label: '2020s' },
			{ value: '2010', label: '2010s' },
			{ value: '2000', label: '2000s' },
			{ value: '1990', label: '1990s' },
			{ value: '1980', label: '1980s' },
			{ value: '1970', label: '1970s' },
			{ value: '1960', label: '1960s' },
			{ value: '1950', label: '1950s' }
		],
		tv: [
			{ value: null, label: 'Alle jare / All years' },
			{ value: '2020', label: '2020s' },
			{ value: '2010', label: '2010s' },
			{ value: '2000', label: '2000s' },
			{ value: '1990', label: '1990s' },
			{ value: '1980', label: '1980s' }
		]
	};

	const SORTS: { value: string; label: string }[] = [
		{ value: 'newest', label: 'Nuutste / Newest' },
		{ value: 'rating', label: 'Beoordeling / Rating' },
		{ value: 'year', label: 'Jaar / Year' },
		{ value: 'title', label: 'Titel / Title' },
		{ value: 'popularity', label: 'Gewildheid / Popularity' }
	];

	let category = $state<string>(browseParams.category ?? 'all');
	let type = $state<string>(browseParams.type ?? 'reekse');
	let genre = $state<string | null>(browseParams.genre ? String(browseParams.genre) : null);
	let decade = $state<string | null>(browseParams.decade ? String(browseParams.decade) : null);
	let sort = $state<string>(browseParams.sort ?? 'newest');

	let browseItems = $state(browse.results ?? []);
	let browsePage = $state(browse.page ?? 1);
	let browseHasMore = $state(browse.hasMore ?? false);
	let loadingMore = $state(false);
	let navigating = $state(false);

	let sentinel: HTMLDivElement | undefined = $state();

	$effect(() => {
		browseItems = browse.results ?? [];
		browsePage = browse.page ?? 1;
		browseHasMore = browse.hasMore ?? false;
		category = browseParams.category ?? 'all';
		type = browseParams.type ?? 'reekse';
		genre = browseParams.genre ? String(browseParams.genre) : null;
		decade = browseParams.decade ? String(browseParams.decade) : null;
		sort = browseParams.sort ?? 'newest';
	});

	const sortedHero = $derived.by(() => {
		const withBackdrop = hero.filter((i) => i.backdropPath);
		const rest = hero.filter((i) => !i.backdropPath);
		return [...withBackdrop, ...rest].slice(0, 5);
	});

	function applyFilters(
		overrides: Partial<{
			category: string;
			type: string;
			genre: string | null;
			decade: string | null;
			sort: string;
		}> = {}
	) {
		const c = overrides.category ?? category;
		const t = overrides.type ?? type;
		const g = overrides.genre !== undefined ? overrides.genre : genre;
		const d = overrides.decade !== undefined ? overrides.decade : decade;
		const s = overrides.sort ?? sort;

		const p = new URLSearchParams();
		if (isMovies && c !== 'all') p.set('category', c);
		if (!isMovies && t !== 'reekse') p.set('type', t);
		if (g) p.set('genre', g);
		if (d) p.set('decade', d);
		if (s && s !== 'newest') p.set('sort', s);

		const base = section === 'movies' ? '/movies' : '/tv';
		const qs = p.toString();
		navigating = true;
		goto(qs ? `${base}?${qs}` : base, { keepFocus: true, invalidateAll: true });
	}

	$effect(() => {
		if (!sentinel) return;
		const io = new IntersectionObserver((entries) => {
			if (entries[0]?.isIntersecting) loadMore();
		});
		io.observe(sentinel);
		return () => io.disconnect();
	});

	async function loadMore() {
		if (loadingMore || !browseHasMore || navigating) return;
		loadingMore = true;
		try {
			const p = new URLSearchParams($page.url.search);
			p.set('page', String(browsePage + 1));
			const res = await fetch(`/${section}/api/discover?${p}`);
			if (!res.ok) throw new Error('Failed');
			const json = await res.json();
			browseItems = [...browseItems, ...(json.results || [])];
			browsePage = json.page;
			browseHasMore = json.hasMore;
		} catch {
			// keep current items; user can scroll again
		} finally {
			loadingMore = false;
		}
	}

	function retry() {
		navigating = true;
		goto(section === 'movies' ? '/movies' : '/tv', { replaceState: true, invalidateAll: true });
	}
</script>

<svelte:head>
	<title>{sectionTitle} — Streamium</title>
</svelte:head>

<div class="wrap-{section}">
	<div class="mx-auto max-w-screen-2xl px-4 py-6 sm:px-6 lg:px-8">
		<div class="mb-4 flex items-baseline justify-between gap-3">
			<div>
				<h1 class="text-2xl font-bold text-foreground sm:text-3xl">{sectionTitle}</h1>
				<p class="mt-1 text-xs text-muted-foreground sm:text-sm">{sectionSub}</p>
			</div>
		</div>

		{#if sortedHero.length > 0}
			<Hero
				movie={null}
				movies={sortedHero}
				autoPlayIntervalMs={8000}
				pauseOnHover
				trailerButton
				trailerLabel="Trailer"
			/>
		{:else if !error}
			<div class="hero-skeleton" aria-hidden="true" aria-busy="true"></div>
		{/if}

		{#if error && rails.length === 0}
			<EmptyState
				icon="error"
				title="Kon nie laai nie / Failed to load"
				subtitle={error}
				actionLabel="Probeer weer / Retry"
				onAction={retry}
			/>
		{:else}
			<div class="mt-10 flex flex-col gap-8">
				{#if rails.length === 0}
					<MediaRowSkeleton />
					<MediaRowSkeleton />
					<MediaRowSkeleton />
				{:else}
					{#each rails as rail (rail.id)}
						{#if rail.items.length >= 4}
							<MediaScrollContainer title={`${rail.titleAf} / ${rail.titleEn}`} media={rail.items} />
						{/if}
					{/each}
				{/if}
			</div>

			<section class="mt-12 px-1 pb-8 sm:px-2" aria-label="Blaai deur alles / Browse all">
				<div class="mb-4 flex flex-wrap items-center justify-between gap-2">
					<div>
						<h2 class="text-xl font-semibold text-foreground sm:text-3xl">Alles</h2>
						<p class="text-xs text-muted-foreground">
							Blaai deur die volle katalogus / Browse the full catalogue
						</p>
					</div>
				</div>

				<div class="mb-6 flex flex-wrap items-center gap-3">
					{#if isMovies}
						<div class="flex overflow-x-auto rounded-xl border border-zinc-800 bg-zinc-900/60" role="group" aria-label="Kategorie / Category">
							{#each CATEGORIES as cat (cat.value)}
								<button
									type="button"
									class="whitespace-nowrap px-3 py-2 text-xs font-medium transition-colors sm:px-4 sm:text-sm"
									class:active-chip={category === cat.value}
									class:text-zinc-400={category !== cat.value}
									aria-pressed={category === cat.value}
									onclick={() => applyFilters({ category: cat.value })}
								>{cat.label}</button>
							{/each}
						</div>
					{:else}
						<div class="flex overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900/60" role="group" aria-label="Tipe / Type">
							{#each TYPES as t (t.value)}
								<button
									type="button"
									class="whitespace-nowrap px-3 py-2 text-xs font-medium transition-colors sm:px-4 sm:text-sm"
									class:active-chip={type === t.value}
									class:text-zinc-400={type !== t.value}
									aria-pressed={type === t.value}
									onclick={() => applyFilters({ type: t.value })}
								>{t.label}</button>
							{/each}
						</div>
					{/if}

					<div class="flex max-w-full flex-wrap items-center gap-2">
						{#each GENRES[section] as g (g.value ?? 'all')}
							<button
								type="button"
								class="chip text-xs"
								class:chip-active={genre === g.value}
								aria-pressed={genre === g.value}
								onclick={() => applyFilters({ genre: g.value })}
							>{g.label}</button>
						{/each}
					</div>

					<div class="ml-auto flex flex-wrap items-center gap-2">
						<label class="text-xs text-zinc-500" for={`${section}-decade`}>Jare / Years</label>
						<select
							id={`${section}-decade`}
							class="sort-select"
							value={decade ?? ''}
							onchange={(e) => applyFilters({ decade: e.currentTarget.value || null })}
						>
							{#each DECADES[section] as d (d.value ?? 'all')}
								<option value={d.value ?? ''}>{d.label}</option>
							{/each}
						</select>

						<label class="text-xs text-zinc-500" for={`${section}-sort`}>Sorteer / Sort</label>
						<select
							id={`${section}-sort`}
							class="sort-select"
							value={sort}
							onchange={(e) => applyFilters({ sort: e.currentTarget.value })}
						>
							{#each SORTS as s (s.value)}
								<option value={s.value}>{s.label}</option>
							{/each}
						</select>
					</div>
				</div>

				{#if error && browseItems.length === 0}
					<EmptyState
						icon="error"
						title="Kon nie laai nie / Failed to load"
						subtitle={error}
						actionLabel="Probeer weer / Retry"
						onAction={retry}
					/>
				{:else if browseItems.length === 0}
					<EmptyState
						icon="search"
						title="Niks gevind nie / Nothing found"
						subtitle="Probeer ander filters / Try different filters"
					/>
				{:else}
					{#if navigating}
						<div class="grid grid-cols-3 gap-4 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
							{#each Array(20) as _, i}
								<div class={i > 11 ? 'hidden sm:block' : ''}>
									<div class="w-full animate-pulse overflow-hidden rounded-xl bg-zinc-800/70" style="aspect-ratio:2/3"></div>
								</div>
							{/each}
						</div>
					{:else}
						<div class="grid grid-cols-3 gap-4 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
							{#each browseItems as item (item.id)}
								<MediaCard movie={toLibraryMovie(item)} />
							{/each}
							{#if loadingMore}
								{#each Array(6) as _, i}
									<div class="hidden sm:block">
										<div class="w-full animate-pulse overflow-hidden rounded-xl bg-zinc-800/70" style="aspect-ratio:2/3"></div>
									</div>
								{/each}
							{/if}
						</div>

						{#if browseHasMore}
							<div class="mt-8 flex justify-center">
								<Button
									type="button"
									onclick={loadMore}
									disabled={loadingMore || navigating}
									class="more-btn gap-2"
								>
									{loadingMore ? 'Laai... / Loading...' : 'Laai Meer / Load More'}
								</Button>
							</div>
							<div bind:this={sentinel} aria-hidden="true" class="h-px w-full"></div>
						{/if}
					{/if}
				{/if}
			</section>
		{/if}
	</div>
</div>

<style>
	.wrap-movies {
		--sec: var(--movies-accent);
		--sec-soft: var(--movies-accent-soft);
		--sec-glow: var(--movies-accent-glow);
		--sec-ink: #1c1200;
	}

	.wrap-tv {
		--sec: var(--tv-accent);
		--sec-soft: var(--tv-accent-soft);
		--sec-glow: var(--tv-accent-glow);
		--sec-ink: #0b1220;
	}

	.hero-skeleton {
		position: relative;
		min-height: 50vh;
		border-radius: 1.5rem;
		overflow: hidden;
		background: linear-gradient(110deg, var(--sec-soft) 25%, color-mix(in srgb, var(--sec) 22%, transparent) 50%, var(--sec-soft) 75%);
		background-size: 200% 100%;
		animation: shimmer 1.6s linear infinite;
	}

	@keyframes shimmer {
		to {
			background-position: -200% 0;
		}
	}

	.active-chip {
		background: var(--sec);
		color: var(--sec-ink);
	}

	.chip {
		border: 1px solid color-mix(in srgb, var(--sec) 45%, transparent);
		background: var(--sec-soft);
		color: var(--sec);
		border-radius: 9999px;
		padding: 0.4rem 0.9rem;
		transition: all 0.2s ease;
	}

	.chip:hover {
		background: var(--sec);
		color: var(--sec-ink);
	}

	.chip-active {
		background: var(--sec);
		color: var(--sec-ink);
	}

	.more-btn {
		border: 1px solid color-mix(in srgb, var(--sec) 55%, transparent);
		background: var(--sec-soft);
		color: var(--sec);
	}

	.more-btn:hover:not(:disabled) {
		background: var(--sec);
		color: var(--sec-ink);
	}

	.sort-select {
		border-radius: 0.75rem;
		border: 1px solid color-mix(in srgb, var(--sec) 35%, transparent);
		background: color-mix(in srgb, var(--sec-soft) 60%, var(--bg-root, #0a0a0f));
		color: #d4d4d8;
		padding: 0.4rem 0.6rem;
		font-size: 0.8rem;
	}
</style>