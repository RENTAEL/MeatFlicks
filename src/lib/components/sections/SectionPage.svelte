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
	import {
		Dialog,
		DialogContent,
		DialogDescription,
		DialogHeader,
		DialogTitle
	} from '$lib/components/ui/dialog';
	import { Button } from '$lib/components/ui/button';
	import { Badge } from '$lib/components/ui/badge';
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
	const sectionSub = isMovies
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

	let query = $state('');
	let serverResults = $state<any[]>([]);
	let searchingServer = $state(false);
	let serverSearched = $state(false);

	let pickOpen = $state(false);
	let pickItem = $state<any>(null);
	let pickTrailer = $state<string | null>(null);
	let picking = $state(false);

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
		query = '';
		goto(qs ? `${base}?${qs}` : base, { keepFocus: true, invalidateAll: true });
	}

	function buildQueryParams(): URLSearchParams {
		const p = new URLSearchParams();
		if (isMovies && category !== 'all') p.set('category', category);
		if (!isMovies && type !== 'reekse') p.set('type', type);
		if (genre) p.set('genre', genre);
		if (decade) p.set('decade', decade);
		if (sort && sort !== 'newest') p.set('sort', sort);
		return p;
	}

	let autoFired = $state(false);

	$effect(() => {
		if (!sentinel || typeof IntersectionObserver === 'undefined') return;
		const io = new IntersectionObserver(
			(entries) => {
				const entry = entries[0];
				if (entry.isIntersecting) {
					if (!autoFired) {
						autoFired = true;
						loadMore();
					}
				} else {
					autoFired = false;
				}
			},
			{ rootMargin: '200px 0px' }
		);
		io.observe(sentinel);
		return () => io.disconnect();
	});

	async function loadMore() {
		if (loadingMore || navigating || !browseHasMore || query) return;
		loadingMore = true;
		try {
			const p = buildQueryParamsWithPage(browsePage + 1);
			const res = await fetch(`/${section}/api/discover?${p}`);
			if (!res.ok) throw new Error('Failed');
			const json = await res.json();
			browseItems = [...browseItems, ...(json.results || [])];
			browsePage = json.page;
			browseHasMore = json.hasMore ?? false;
		} catch {
			// user can retry via the button
		} finally {
			loadingMore = false;
		}
	}

	function buildQueryParamsWithPage(pg: number): URLSearchParams {
		const p = buildQueryParams();
		p.set('page', String(pg));
		return p;
	}

	const clientMatches = $derived(
		query
			? (browseItems as any[]).filter((m) => {
					const q = query.toLowerCase();
					return (
						(m.title ?? '').toLowerCase().includes(q) ||
						(m.overview ?? '').toLowerCase().includes(q)
					);
				})
			: null
	);

	const needsServer = $derived(
		query.trim().length >= 3 && clientMatches !== null && clientMatches.length === 0
	);

	$effect(() => {
		serverSearched = false;
		serverResults = [];
		if (!needsServer) return;
		searchingServer = true;
		const q = query.trim();
		const timer = setTimeout(async () => {
			try {
				if (query.trim() !== q) return;
				const res = await fetch(`/${section}/api/search?q=${encodeURIComponent(q)}`);
				if (!res.ok) throw new Error('Failed');
				const json = await res.json();
				if (query.trim() !== q) return;
				serverResults = json.results ?? [];
			} catch {
				serverResults = [];
			} finally {
				if (query.trim() === q) {
					searchingServer = false;
					serverSearched = true;
				}
			}
		}, 350);
		return () => {
			clearTimeout(timer);
			searchingServer = false;
		};
	});

	const gridCards = $derived.by(() => {
		if (query) {
			if (clientMatches && clientMatches.length > 0) return clientMatches;
			if (serverSearched && serverResults.length > 0) return serverResults;
			return [];
		}
		return browseItems;
	});

	const gridKey = (m: any) => `${m.mediaType ?? m.media_type ?? 'movie'}:${m.id}`;

	async function rollPick() {
		if (picking) return;
		picking = true;
		pickTrailer = null;
		try {
			const res = await fetch(`/${section}/api/discover?${buildQueryParamsWithPage(1)}`);
			if (!res.ok) throw new Error('Failed');
			const first = await res.json();
			let pool: any[] = first.results ?? [];
			const totalPages = first.total_pages ?? 1;
			if (totalPages > 1) {
				const extraPage = Math.floor(Math.random() * Math.min(totalPages, 5)) + 2;
				try {
					const res2 = await fetch(`/${section}/api/discover?${buildQueryParamsWithPage(extraPage)}`);
					if (res2.ok) {
						const extra = await res2.json();
						pool = [...pool, ...(extra.results ?? [])];
					}
				} catch {
					// keep pool
				}
			}
			pickItem = pool.length ? pool[Math.floor(Math.random() * pool.length)] : null;
			if (pickItem) loadPickTrailer();
		} catch {
			pickItem = null;
		} finally {
			picking = false;
		}
	}

	async function loadPickTrailer() {
		if (!pickItem) return;
		const mediaType = (pickItem.mediaType ?? pickItem.media_type ?? 'movie') === 'tv' ? 'tv' : 'movie';
		try {
			const res = await fetch(`/api/tmdb/${mediaType}/${pickItem.id}`);
			if (!res.ok) return;
			const data = await res.json();
			const videos = data.videos?.results ?? [];
			const trailler = videos.find((v: any) => v.site === 'YouTube' && v.type === 'Trailer') ?? videos.find((v: any) => v.site === 'YouTube' && v.type === 'Teaser');
			if (trailler?.key) pickTrailer = `https://www.youtube.com/watch?v=${trailler.key}`;
		} catch {
			// trailer optional
		}
	}

	function openPick() {
		pickOpen = true;
		rollPick();
	}

	const pickDetailsHref = $derived(
		pickItem ? `/${(pickItem.mediaType ?? pickItem.media_type ?? 'movie') === 'tv' ? 'tv' : 'movie'}/${pickItem.id}` : '#'
	);

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
					<Button
						type="button"
						onclick={openPick}
						class="kies-btn gap-2 font-semibold"
						aria-label="Kies vir my / Pick for me"
					>
						<Shuffle class="size-4" aria-hidden="true" />
						Kies vir my / Pick for me
					</Button>
				</div>

				<div class="mb-6 flex flex-wrap items-center gap-3">
					<div class="relative min-w-0 flex-1 max-w-xs">
						<Search class="search-icon" aria-hidden="true" />
						<input
							type="search"
							class="search-input"
							placeholder="Soek in katalogus / Search catalogue."
							bind:value={query}
							aria-label="Soek / Search"
						/>
						{#if query}
							<button
								type="button"
								class="search-clear"
								onclick={() => (query = '')}
								aria-label="Maak skoon / Clear"
							>
								<X class="size-4" aria-hidden="true" />
							</button>
						{/if}
					</div>

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
				{:else if query && clientMatches !== null && clientMatches.length === 0 && !searchingServer && !serverSearched}
					<EmptyState
						icon="search"
						title="Soek. / Searching."
						subtitle="Soek verder op TMDB as jy langer tik / Search TMDB too if you keep typing"
					/>
				{:else if query && serverSearched && serverResults.length === 0}
					<EmptyState
						icon="search"
						title="Geen resultate / No results"
						subtitle="Probeer 'n ander soektog / Try a different search"
					/>
				{:else if gridCards.length === 0 && !query}
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
							{#each gridCards as item (gridKey(item))}
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

						{#if !query && browseHasMore}
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

<Dialog bind:open={pickOpen}>
	<DialogContent class="w-[min(96vw,720px)] border border-border bg-card text-foreground">
		<DialogHeader>
			<DialogTitle class="flex items-center gap-2 text-lg font-semibold">
				<Shuffle class="size-4 text-[var(--sec)]" aria-hidden="true" />
				Kies vir my / Pick for me
			</DialogTitle>
			<DialogDescription class="text-sm text-muted-foreground">
				'n lukraak keuring uit jou huidige filters / A random pick from your current filters
			</DialogDescription>
		</DialogHeader>

		{#if picking}
			<div class="flex min-h-64 items-center justify-center" aria-live="polite">
				<p class="text-sm text-muted-foreground">Kies. / Picking.</p>
			</div>
		{:else if pickItem}
			<div class="grid gap-4 sm:grid-cols-[200px_1fr]">
				<div class="relative aspect-[2/3] w-full overflow-hidden rounded-xl bg-zinc-900">
					{#if pickItem.poster}
						<img src={pickItem.poster} alt="" loading="lazy" class="h-full w-full object-cover" />
					{/if}
				</div>
				<div class="flex flex-col gap-3">
					<h3 class="text-xl font-bold text-foreground">{pickItem.title}</h3>
					<div class="flex flex-wrap items-center gap-2 text-sm">
						<Badge variant="secondary" class="bg-foreground/10 text-foreground">
							{isMovies ? 'Fliek / Movie' : 'Reeks / Series'}
						</Badge>
						{#if pickItem.year && pickItem.year !== '-'}
							<Badge variant="outline" class="border-foreground/20 text-foreground">{pickItem.year}</Badge>
						{/if}
						{#if pickItem.rating > 0}
							<Badge variant="outline" class="flex items-center gap-1 border-foreground/20 text-foreground">
								<Star class="size-3.5 text-[var(--sec)]" aria-hidden="true" />
								{pickItem.rating.toFixed(1)}
							</Badge>
						{/if}
					</div>
					{#if pickItem.overview}
						<p class="line-clamp-4 text-sm leading-relaxed text-foreground/80">{pickItem.overview}</p>
					{/if}
					<div class="mt-auto flex flex-wrap gap-3 pt-2">
						<Button type="button" onclick={rollPick} class="gap-2 font-semibold">
							<Shuffle class="size-4" aria-hidden="true" />
							Nog een / Another
						</Button>
						{#if pickTrailer}
							<a
								href={pickTrailer}
								target="_blank"
								rel="noopener noreferrer"
								class="inline-flex items-center gap-1.5 rounded-lg bg-foreground/10 px-3 py-1.5 text-xs font-medium text-foreground hover:bg-foreground/20"
							>
								Trailer
							</a>
						{/if}
						<Button type="button" variant="secondary" onclick={() => goto(pickDetailsHref)}>
							Kyk nou / Watch now
						</Button>
					</div>
				</div>
			</div>
		{:else}
			<div class="flex min-h-40 items-center justify-center" aria-live="polite">
				<p class="text-sm text-muted-foreground">
					Niks gevind met hierdie filters nie / Nothing found with these filters
				</p>
			</div>
		{/if}
	</DialogContent>
</Dialog>

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

	.kies-btn {
		background: var(--sec-soft);
		color: var(--sec);
		border: 1px solid var(--sec);
	}

	.kies-btn:hover {
		background: var(--sec);
		color: var(--sec-ink);
	}

	.search-input {
		border-radius: 0.75rem;
		border: 1px solid color-mix(in srgb, var(--sec) 35%, transparent);
		background: color-mix(in srgb, var(--sec-soft) 40%, var(--bg-root, #0a0a0f));
		color: #d4d4d8;
		width: 100%;
		padding: 0.5rem 2.2rem 0.5rem 2.4rem;
		font-size: 0.85rem;
	}

	.search-icon {
		position: absolute;
		left: 0.75rem;
		top: 0.7rem;
		height: 1rem;
		width: 1rem;
		color: #71717a;
	}

	.search-clear {
		position: absolute;
		right: 0.5rem;
		top: 0.55rem;
		color: #71717a;
	}

	.search-clear:hover {
		color: #d4d4d8;
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