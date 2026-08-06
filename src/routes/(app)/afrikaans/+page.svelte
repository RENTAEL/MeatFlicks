<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import type { PageData } from './$types';
	import { Search, Shuffle, Star, X } from '@lucide/svelte';
	import Hero from '$lib/components/home/Hero.svelte';
	import MediaScrollContainer from '$lib/components/media/MediaScrollContainer.svelte';
	import MediaCard from '$lib/components/media/MediaCard.svelte';
	import SkeletonCard from '$lib/components/SkeletonCard.svelte';
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
	import { SEOHead } from '$lib/components/seo';

	let { data }: { data: PageData } = $props();

	const rails = $derived(data.rails ?? []);

	const heroItems = $derived(rails.find((r) => r.id === 'featured')?.items ?? []);
	const heroSlides = $derived.by(() => {
		const withBackdrop = heroItems.filter((i) => i.backdropPath);
		const rest = heroItems.filter((i) => !i.backdropPath);
		return [...withBackdrop, ...rest].slice(0, 5);
	});

	type TypeValue = 'flieks' | 'reekse' | 'alles';
	let type = $state<TypeValue>(
		data.browseParams.type === 'tv' ? 'reekse' : data.browseParams.type === 'alles' ? 'alles' : 'flieks'
	);
	let genre = $state<string | null>(data.browseParams.genre ? String(data.browseParams.genre) : null);
	let decade = $state<string | null>(data.browseParams.decade ? String(data.browseParams.decade) : null);
	let sort = $state<string>(data.browseParams.sort ?? 'newest');

	let browseItems = $state(data.browse?.results ?? []);
	let browsePage = $state(data.browse?.page ?? 1);
	let browseHasMore = $state(data.browse?.hasMore ?? false);
	let loadingMore = $state(false);
	let navigating = $state(false);

	let sentinel: HTMLDivElement | undefined = $state();

	let query = $state('');
	let serverResults = $state<any[]>([]);
	let searchingServer = $state(false);
	let serverSearched = $state(false);

	let pickOpen = $state(false);
	let pickItem = $state<any>(null);
	let picking = $state(false);

	const TYPES: { value: TypeValue; label: string }[] = [
		{ value: 'flieks', label: 'Flieks / Movies' },
		{ value: 'reekse', label: 'Reekse / Series' },
		{ value: 'alles', label: 'Alles / All' }
	];

	const GENRES: { value: string | null; label: string }[] = [
		{ value: null, label: 'Alle genres / All genres' },
		{ value: '18', label: 'Drama' },
		{ value: '35', label: 'Komedie' },
		{ value: '99', label: 'Dokumentêre' }
	];

	const DECADES: { value: string | null; label: string }[] = [
		{ value: null, label: 'Alle jare / All years' },
		{ value: '2020', label: '2020s' },
		{ value: '2010', label: '2010s' },
		{ value: '2000', label: '2000s' },
		{ value: '1990', label: '1990s' },
		{ value: '1980', label: '1980s' }
	];

	const SORTS: { value: string; label: string }[] = [
		{ value: 'newest', label: 'Nuutste / Newest' },
		{ value: 'rating', label: 'Beoordeling / Rating' },
		{ value: 'year', label: 'Jaar / Year' },
		{ value: 'title', label: 'Titel / Title' },
		{ value: 'popularity', label: 'Gewildheid / Popularity' }
	];

	function buildBrowseParams(overrides: Partial<{ type: TypeValue; genre: string | null; decade: string | null; sort: string }> = {}) {
		const t = overrides.type ?? type;
		const g = overrides.genre !== undefined ? overrides.genre : genre;
		const d = overrides.decade !== undefined ? overrides.decade : decade;
		const s = overrides.sort ?? sort;
		const p = new URLSearchParams();
		if (t !== 'flieks') p.set('type', t);
		if (g) p.set('genre', g);
		if (d) p.set('decade', d);
		if (s && s !== 'newest') p.set('sort', s);
		return p;
	}

	function currentPath(qs: URLSearchParams): string {
		return `/afrikaans${qs.size ? `?${qs}` : ''}`;
	}

	function applyFilters(overrides?: Partial<{ type: TypeValue; genre: string | null; decade: string | null; sort: string }>) {
		const next = currentPath(buildBrowseParams(overrides));
		const current = $page.url.pathname + $page.url.search;
		if (next === current) return;
		navigating = true;
		goto(next, { keepFocus: true, noScroll: true });
	}

	$effect(() => {
		if (!navigating || !data.browse) return;
		browseItems = data.browse.results ?? [];
		browsePage = data.browse.page ?? 1;
		browseHasMore = data.browse.hasMore ?? false;
		navigating = false;
	});

	async function loadMore() {
		if (loadingMore || navigating || !browseHasMore) return;
		loadingMore = true;
		try {
			const p = buildBrowseParams({});
			p.set('page', String(browsePage + 1));
			const res = await fetch(`/afrikaans/api/discover?${p}`);
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

	$effect(() => {
		if (!sentinel || typeof IntersectionObserver === 'undefined') return;
		const io = new IntersectionObserver(
			(entries) => {
				if (entries[0].isIntersecting) loadMore();
			},
			{ rootMargin: '600px 0px' }
		);
		io.observe(sentinel);
		return () => io.disconnect();
	});

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
				const res = await fetch(`/afrikaans/api/search?q=${encodeURIComponent(q)}`);
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

	async function rollPick() {
		if (picking) return;
		picking = true;
		try {
			const p = buildBrowseParams({});
			p.set('page', '1');
			const res = await fetch(`/afrikaans/api/discover?${p}`);
			if (!res.ok) throw new Error('Failed');
			const first = await res.json();
			let pool: any[] = first.results ?? [];
			const totalPages = first.total_pages ?? 1;
			if (totalPages > 1) {
				const extraPage = Math.floor(Math.random() * Math.min(totalPages, 5)) + 2;
				const p2 = buildBrowseParams({});
				p2.set('page', String(extraPage));
				try {
					const res2 = await fetch(`/afrikaans/api/discover?${p2}`);
					if (res2.ok) {
						const extra = await res2.json();
						pool = [...pool, ...(extra.results ?? [])];
					}
				} catch {
					// keep pool
				}
			}
			pickItem = pool.length ? pool[Math.floor(Math.random() * pool.length)] : null;
		} catch {
			pickItem = null;
		} finally {
			picking = false;
		}
	}

	function openPick() {
		pickOpen = true;
		rollPick();
	}

	const pickDetailsHref = $derived(
		pickItem ? `/${pickItem.mediaType === 'tv' ? 'tv' : 'movie'}/${pickItem.id}` : '#'
	);

	const gridKey = (m: any) => `${m.mediaType ?? m.media_type ?? 'movie'}:${m.id}`;

	const gridCards = $derived.by(() => {
		if (query) {
			if (clientMatches && clientMatches.length > 0) return clientMatches;
			if (serverSearched && serverResults.length > 0) return serverResults;
			return [];
		}
		return browseItems;
	});

	const gridNote = $derived.by(() => {
		if (!query) return null;
		if (clientMatches && clientMatches.length > 0)
			return `${clientMatches.length} resultaat${clientMatches.length === 1 ? '' : 'e'} in die katalogus / in catalogue`;
		if (serverSearched && serverResults.length > 0)
			return `Soekresultate van TMDB / Search results from TMDB`;
		return null;
	});
</script>

<SEOHead
	title="Afrikaans Films — Streamium"
	description="Verken Afrikaanse flieks en reekse — Browse Afrikaans-language films and series on Streamium."
	canonical="/afrikaans"
	ogType="website"
	keywords={[
		'Afrikaans films',
		'Afrikaanse flieks',
		'South African cinema',
		'Afrikaans series',
		'Afrikaanse reekse',
		'streaming'
	]}
/>

<div class="mx-auto max-w-screen-2xl px-4 py-6 sm:px-6 lg:px-8">
	<div class="mb-2 flex items-center justify-between">
		<h1 class="text-2xl font-bold text-foreground">Afrikaans Films</h1>
	</div>
	<p class="mb-6 text-sm text-muted-foreground">Verken Afrikaanse flieks en reekse / Browse Afrikaans film and series</p>

	{#if heroSlides.length}
		<div class="mb-8">
			<Hero movies={heroSlides} pauseOnHover autoPlayIntervalMs={8000} />
		</div>
	{/if}

	{#if rails.length}
		{#each rails as rail (rail.id)}
			{#if rail.items.length >= 4}
				<MediaScrollContainer title={rail.title} media={rail.items} />
			{/if}
		{/each}
	{:else}
		<div class="space-y-8 px-[5%] py-6 sm:px-[10%]">
			<MediaRowSkeleton variant="poster" items={7} />
			<MediaRowSkeleton variant="poster" items={7} />
			<MediaRowSkeleton variant="poster" items={7} />
		</div>
	{/if}

	<section class="px-2 py-6 sm:px-4" aria-label="Verken alles / Browse all">
		<div class="mb-4 flex flex-wrap items-center justify-between gap-2">
			<div>
				<h2 class="text-xl font-semibold text-foreground sm:text-3xl">Alles</h2>
				<p class="text-xs text-muted-foreground">Blaai deur die volle katalogus / Browse the full catalogue</p>
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
					placeholder="Soek in katalogus / Search catalogue…"
					bind:value={query}
					aria-label="Soek / Search"
				/>
				{#if query}
					<button type="button" class="search-clear" onclick={() => (query = '')} aria-label="Maak skoon / Clear">
						<X class="size-4" aria-hidden="true" />
					</button>
				{/if}
			</div>

			<div class="flex overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900/60" role="group" aria-label="Tipe / Type">
				{#each TYPES as t (t.value)}
					<button
						type="button"
						class="px-3 py-2 text-xs font-medium transition-colors sm:px-4 sm:text-sm"
						class:afrikaans-active={type === t.value}
						class:text-zinc-400={type !== t.value}
						aria-pressed={type === t.value}
						onclick={() => applyFilters({ type: t.value })}
					>{t.label}</button>
				{/each}
			</div>

			<div class="flex flex-wrap items-center gap-2">
				{#each GENRES as g (g.value ?? 'all')}
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
				<label class="text-xs text-zinc-500" for="afrikaans-decade">Jare / Years</label>
				<select
					id="afrikaans-decade"
					class="sort-select"
					value={decade ?? ''}
					onchange={(e) => applyFilters({ decade: (e.currentTarget.value || null) })}
				>
					{#each DECADES as d (d.value ?? 'all')}
						<option value={d.value ?? ''}>{d.label}</option>
					{/each}
				</select>

				<label class="text-xs text-zinc-500" for="afrikaans-sort">Sorteer / Sort</label>
				<select
					id="afrikaans-sort"
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

		{#if gridNote}
			<p class="mb-4 text-sm text-zinc-500" role="status">{gridNote}</p>
		{/if}

		{#if data.error}
			<EmptyState
				icon="error"
				title="Kon nie laai nie / Failed to load films"
				subtitle="Netwerkprobleem met TMDB / Network problem with TMDB"
				actionLabel="Probeer weer / Retry"
				onAction={() => goto('/afrikaans')}
			/>
		{:else if query && clientMatches !== null && clientMatches.length === 0 && !searchingServer && !serverSearched}
			<EmptyState
				icon="search"
				title="Soek… / Searching…"
				subtitle="Soek verder op TMDB as jy langer tik / Search TMDB too if you keep typing"
			/>
		{:else if navigating || searchingServer}
			<div class="grid grid-cols-3 gap-4 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
				{#each Array(20) as _, i}
					<div class={i > 11 ? 'hidden sm:block' : ''}>
						<SkeletonCard />
					</div>
				{/each}
			</div>
		{:else if gridCards.length === 0}
			<EmptyState
				icon="search"
				title={query ? `Geen resultate vir "${query}" nie / No results for "${query}"` : 'Niks gevind nie / Nothing found'}
				subtitle={query
					? 'Probeer \'n ander soektog / Try a different search'
					: 'Probeer \'n ander kombinasie / Try a different combination'}
				actionLabel={query ? 'Maak skoon / Clear' : undefined}
				onAction={query ? () => (query = '') : undefined}
			/>
		{:else}
			<div class="grid grid-cols-3 gap-4 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
				{#each gridCards as m (gridKey(m))}
					<MediaCard movie={toLibraryMovie(m)} />
				{/each}
			</div>

			{#if !query && browseHasMore && !navigating}
				<div class="mt-8 flex justify-center">
					<button
						type="button"
						onclick={loadMore}
						disabled={loadingMore}
						class="afrikaans-more rounded-xl border border-zinc-800 bg-zinc-900/60 px-8 py-3 text-sm font-medium text-zinc-300 backdrop-blur-sm transition-colors hover:bg-zinc-800 disabled:opacity-50"
					>
						{loadingMore ? 'Laai... / Loading...' : 'Laai Meer / Load More'}
					</button>
				</div>
				<div bind:this={sentinel} aria-hidden="true" class="h-px w-full"></div>
			{/if}
		{/if}
	</section>
</div>

<Dialog bind:open={pickOpen}>
	<DialogContent class="w-[min(96vw,720px)] border border-border bg-card text-foreground">
		<DialogHeader>
			<DialogTitle class="flex items-center gap-2 text-lg font-semibold">
				<Shuffle class="size-4 text-[var(--afrikaans-accent)]" aria-hidden="true" />
				Kies vir my / Pick for me
			</DialogTitle>
			<DialogDescription class="text-sm text-muted-foreground">
				'n lukraak keuse uit jou huidige filters / A random pick from your current filters}
			</DialogDescription>
		</DialogHeader>

		{#if picking}
			<div class="flex min-h-64 items-center justify-center" aria-live="polite">
				<p class="text-sm text-muted-foreground">Kies… / Picking…</p>
			</div>
		{:else if pickItem}
			<div class="grid gap-4 sm:grid-cols-[200px_1fr]">
				<div class="relative aspect-[2/3] w-full overflow-hidden rounded-xl bg-zinc-900">
					{#if pickItem.poster}
						<img
							src={pickItem.poster}
							alt=""
							loading="lazy"
							class="h-full w-full object-cover"
						/>
					{/if}
				</div>
				<div class="flex flex-col gap-3">
					<h3 class="text-xl font-bold text-foreground">{pickItem.title}</h3>
					<div class="flex flex-wrap items-center gap-2 text-sm">
						<Badge variant="secondary" class="bg-foreground/10 text-foreground">
							{pickItem.mediaType === 'tv' ? 'Reeks / Series' : 'Fliek / Movie'}
						</Badge>
						{#if pickItem.year && pickItem.year !== '—'}
							<Badge variant="outline" class="border-foreground/20 text-foreground">{pickItem.year}</Badge>
						{/if}
						{#if pickItem.rating > 0}
							<Badge variant="outline" class="flex items-center gap-1 border-foreground/20 text-foreground">
								<Star class="size-3.5 text-[var(--afrikaans-accent)]" aria-hidden="true" />
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
	.afrikaans-active {
		background: var(--afrikaans-accent);
		color: #1a1200;
	}

	.kies-btn {
		background: var(--afrikaans-accent-soft);
		color: var(--afrikaans-accent);
		border: 1px solid var(--afrikaans-accent);
	}

	.kies-btn:hover {
		background: var(--afrikaans-accent);
		color: #1a1200;
	}

	.afrikaans-more:hover {
		border-color: var(--afrikaans-accent);
		color: var(--afrikaans-accent);
		background: var(--afrikaans-accent-soft);
	}

	.chip {
		padding: 6px 12px;
		border-radius: 999px;
		border: 1px solid #27272a;
		background: rgba(24, 24, 27, 0.6);
		color: #a1a1aa;
		font-weight: 500;
		transition: all 0.15s;
		cursor: pointer;
	}

	.chip:hover {
		color: var(--afrikaans-accent);
		border-color: var(--afrikaans-accent);
	}

	.chip-active {
		background: var(--afrikaans-accent-soft);
		border-color: var(--afrikaans-accent);
		color: var(--afrikaans-accent);
	}

	.sort-select {
		padding: 8px 12px;
		background: rgba(24, 24, 27, 0.6);
		border: 1px solid #27272a;
		border-radius: 12px;
		color: #e4e4e7;
		font-size: 13px;
		font-weight: 500;
		cursor: pointer;
		outline: none;
		transition: all 0.15s;
	}

	.sort-select:hover {
		border-color: var(--afrikaans-accent);
		color: var(--afrikaans-accent);
	}

	.sort-select option {
		background: #18181b;
		color: #e4e4e7;
	}

	.search-input-wrap {
		position: relative;
	}

	.search-icon {
		position: absolute;
		left: 12px;
		top: 50%;
		transform: translateY(-50%);
		width: 15px;
		height: 15px;
		color: #71717a;
		pointer-events: none;
	}

	.search-input {
		width: 100%;
		padding: 9px 36px 9px 36px;
		border-radius: 12px;
		border: 1px solid #27272a;
		background: rgba(24, 24, 27, 0.6);
		color: #e4e4e7;
		font-size: 14px;
		outline: none;
		transition: border-color 0.15s;
	}

	.search-input:focus {
		border-color: var(--afrikaans-accent);
	}

	.search-input::placeholder {
		color: #52525b;
	}

	.search-clear {
		position: absolute;
		right: 10px;
		top: 50%;
		transform: translateY(-50%);
		background: none;
		border: none;
		color: #71717a;
		cursor: pointer;
		padding: 4px;
	}

	.search-clear:hover {
		color: #e4e4e7;
	}

	@media (max-width: 640px) {
		.chip {
			padding: 5px 10px;
			font-size: 12px;
		}
	}
</style>
