<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import type { PageData } from './$types';
	import Hero from '$lib/components/home/Hero.svelte';
	import MediaScrollContainer from '$lib/components/media/MediaScrollContainer.svelte';
	import MediaCard from '$lib/components/media/MediaCard.svelte';
	import SkeletonCard from '$lib/components/SkeletonCard.svelte';
	import EmptyState from '$lib/components/media/EmptyState.svelte';
	import MediaRowSkeleton from '$lib/components/skeletons/MediaRowSkeleton.svelte';
	import { toLibraryMovie } from '$lib/utils/tmdb';

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

	const gridKey = (m: any) => `${m.media_type ?? 'movie'}:${m.id}`;
</script>

<svelte:head>
	<title>Afrikaans Films — Streamium</title>
	<meta name="description" content="Verken Afrikaanse flieks en reekse — Browse Afrikaans-language films and series." />
</svelte:head>

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
		<div class="mb-4 flex flex-wrap items-baseline justify-between gap-2">
			<h2 class="text-xl font-semibold text-foreground sm:text-3xl">Alles</h2>
			<p class="text-xs text-muted-foreground">Blaai deur die volle katalogus / Browse the full catalogue</p>
		</div>

		<div class="mb-6 flex flex-wrap items-center gap-3">
			<div class="flex overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900/60" role="group" aria-label="Tipe / Type">
				{#each TYPES as t (t.value)}
					<button
						type="button"
						class="px-3 py-2 text-xs font-medium transition-colors sm:px-4 sm:text-sm"
						class:afrikaans-active={type === t.value}
						class:text-zinc-400={type !== t.value}
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

		{#if data.error}
			<EmptyState
				icon="error"
				title="Kon nie laai nie / Failed to load films"
				subtitle="Netwerkprobleem met TMDB / Network problem with TMDB"
				actionLabel="Probeer weer / Retry"
				onAction={() => goto('/afrikaans')}
			/>
		{:else if navigating}
			<div class="grid grid-cols-3 gap-4 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
				{#each Array(20) as _, i}
					<div class={i > 11 ? 'hidden sm:block' : ''}>
						<SkeletonCard />
					</div>
				{/each}
			</div>
		{:else if browseItems.length === 0}
			<EmptyState
				icon="search"
				title="Niks gevind nie / Nothing found"
				subtitle="Probeer 'n ander kombinasie / Try a different combination"
			/>
		{:else}
			<div class="grid grid-cols-3 gap-4 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
				{#each browseItems as m (gridKey(m))}
					<MediaCard movie={toLibraryMovie(m)} />
				{/each}
			</div>

			{#if browseHasMore && !navigating}
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

<style>
	.afrikaans-active {
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

	@media (max-width: 640px) {
		.chip {
			padding: 5px 10px;
			font-size: 12px;
		}
	}
</style>
