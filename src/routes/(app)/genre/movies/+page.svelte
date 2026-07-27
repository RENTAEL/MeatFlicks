<script lang="ts">
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import { Sparkles, AlertCircle, RotateCw, ChevronLeft } from '@lucide/svelte';
  import MediaCard from '$lib/components/media/MediaCard.svelte';
  import { Button } from '$lib/components/ui/button';
  import SEOHead from '$lib/components/seo/SEOHead.svelte';
  import type { PageData } from './$types';
  import type { LibraryMovie } from '$lib/types/library';

  let { data } = $props<{ data: PageData }>();

  const genres = $derived(data.genres ?? []);
  const activeGenreId = $derived(data.activeGenreId ?? '');
  const allMovies = $derived((data.movies ?? []) as LibraryMovie[]);
  const totalPages = $derived(data.totalPages ?? 1);
  const fetchError = $derived(data.fetchError ?? '');

  const activeGenreName = $derived(
    genres.find((g) => String(g.id) === activeGenreId)?.name || ''
  );

  let currentPage = $state(1);
  let movies = $state<LibraryMovie[]>(allMovies);
  let isLoadingMore = $state(false);
  let loadError = $state('');
  let sentinel = $state<HTMLDivElement | null>(null);

  $effect(() => {
    currentPage = 1;
    movies = allMovies;
    isLoadingMore = false;
    loadError = '';
  });

  function selectGenre(id: number) {
    const params = new URLSearchParams($page.url.searchParams);
    params.set('genreId', String(id));
    params.delete('page');
    goto(`?${params.toString()}`, { keepFocus: true, noScroll: true });
  }

  async function loadMore() {
    if (isLoadingMore || currentPage >= totalPages || !activeGenreId) return;
    isLoadingMore = true;
    loadError = '';
    const nextPage = currentPage + 1;
    try {
      const res = await fetch(`/api/tmdb/discover/movie?page=${nextPage}&sort_by=popularity.desc&vote_count.gte=50&with_genres=${activeGenreId}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || `API error ${res.status}`);
      const existingIds = new Set(movies.map((m) => m.id));
      const newMovies = (json.results ?? [])
        .filter((m: any) => !existingIds.has(String(m.id)))
        .map((m: any) => mapResult(m));
      movies = [...movies, ...newMovies];
      currentPage = nextPage;
    } catch (e: any) {
      loadError = e.message || 'Failed to load more';
    } finally {
      isLoadingMore = false;
    }
  }

  function mapResult(item: any): LibraryMovie {
    return {
      id: String(item.id),
      tmdbId: item.id,
      title: item.title || item.name || 'Untitled',
      overview: item.overview || null,
      posterPath: item.poster_path || null,
      backdropPath: item.backdrop_path || null,
      releaseDate: item.release_date || null,
      rating: item.vote_average || null,
      durationMinutes: null,
      is4K: false,
      isHD: true,
      mediaType: 'movie',
      media_type: 'movie',
      genres: [],
      imdbId: null,
      trailerUrl: null
    } as LibraryMovie;
  }

  import { onMount } from 'svelte';

  onMount(() => {
    if (!sentinel) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !isLoadingMore && currentPage < totalPages) {
          loadMore();
        }
      },
      { rootMargin: '400px' }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  });
</script>

<SEOHead
  title={activeGenreName ? `${activeGenreName} Movies` : 'Browse Movies by Genre'}
  description={activeGenreName ? `Browse ${activeGenreName} movies - Stream free movies and TV shows` : 'Browse movies by genre - Stream free movies and TV shows'}
/>

<div class="min-h-screen bg-background">
  <main class="pb-16">
    <div class="sticky top-0 z-40 bg-background/90 backdrop-blur-md border-b border-border/10">
      <div class="flex items-center gap-3 px-4 pt-4 pb-2">
        <a href="/explore/movies" class="text-muted-foreground hover:text-foreground transition-colors">
          <ChevronLeft class="size-5" />
        </a>
        <h1 class="text-xl font-bold text-foreground">Browse by Genre</h1>
      </div>

      <div class="genre-chips-wrap">
        <div class="genre-chips hide-scrollbar">
          {#each genres as genre (genre.id)}
            <button
              class="genre-chip"
              class:active={String(genre.id) === activeGenreId}
              onclick={() => selectGenre(genre.id)}
            >
              {genre.name}
            </button>
          {/each}
        </div>
      </div>
    </div>

    <div class="px-4 pt-4">
      {#if fetchError && !activeGenreId}
        <div class="flex flex-col items-center gap-3 py-16 text-center">
          <AlertCircle class="size-10 text-destructive" />
          <h2 class="text-xl font-semibold text-foreground">Failed to load genres</h2>
          <p class="max-w-md text-sm text-muted-foreground">{fetchError}</p>
          <Button href="." size="sm" variant="outline" class="gap-2">
            <RotateCw class="size-4" />
            Retry
          </Button>
        </div>
      {:else if !activeGenreId}
        <div class="flex flex-col items-center gap-3 py-20 text-center">
          <Sparkles class="size-10 text-muted-foreground" />
          <h2 class="text-xl font-semibold text-foreground">Select a genre</h2>
          <p class="max-w-sm text-sm text-muted-foreground">
            Pick a genre above to discover popular movies.
          </p>
        </div>
      {:else if fetchError}
        <div class="flex flex-col items-center gap-3 py-16 text-center">
          <AlertCircle class="size-10 text-destructive" />
          <h2 class="text-xl font-semibold text-foreground">Failed to load movies</h2>
          <p class="max-w-md text-sm text-muted-foreground">{fetchError}</p>
          <Button href="?genreId={activeGenreId}" size="sm" variant="outline" class="gap-2">
            <RotateCw class="size-4" />
            Retry
          </Button>
        </div>
      {:else}
        {#if activeGenreName}
          <h2 class="mb-4 text-lg font-semibold text-foreground">{activeGenreName} Movies</h2>
        {/if}

        <div class="explore-grid">
          {#each movies as movie (movie.id)}
            <MediaCard {movie} />
          {/each}
        </div>

        {#if loadError}
          <div class="load-error">
            <AlertCircle class="size-5" />
            <span>{loadError}</span>
            <button onclick={loadMore}>Retry</button>
          </div>
        {/if}

        {#if isLoadingMore}
          <div class="explore-grid mt-4">
            {#each Array.from({ length: 6 }) as _, index (index)}
              <MediaCard movie={null} />
            {/each}
          </div>
        {/if}

        {#if currentPage < totalPages}
          <div class="load-more">
            <button onclick={loadMore} disabled={isLoadingMore}>
              {isLoadingMore ? 'Loading more...' : 'Load More'}
            </button>
            <span class="page-info">Page {currentPage} of {totalPages}</span>
          </div>
        {:else if movies.length > 0 && !isLoadingMore}
          <p class="end-message">You've reached the end — {movies.length} movies loaded.</p>
        {/if}

        <div bind:this={sentinel} class="h-10 w-full"></div>
      {/if}
    </div>
  </main>
</div>

<style>
  .genre-chips-wrap {
    padding: 0.5rem 1rem;
  }

  .genre-chips {
    display: flex;
    gap: 0.5rem;
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
    scroll-snap-type: x mandatory;
    padding-bottom: 0.5rem;
  }

  .genre-chip {
    flex-shrink: 0;
    scroll-snap-align: start;
    padding: 0.4rem 1rem;
    border-radius: 999px;
    font-size: 0.85rem;
    font-weight: 600;
    border: 1px solid hsl(var(--border));
    background: hsl(var(--muted));
    color: hsl(var(--muted-foreground));
    cursor: pointer;
    transition: all 0.15s ease;
    white-space: nowrap;
  }

  .genre-chip:hover {
    background: hsl(var(--accent));
    color: hsl(var(--accent-foreground));
  }

  .genre-chip.active {
    background: hsl(var(--primary));
    color: hsl(var(--primary-foreground));
    border-color: hsl(var(--primary));
  }

  .explore-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
    gap: 1rem;
    justify-items: center;
  }

  @media (max-width: 767px) {
    .explore-grid {
      grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
      gap: 0.75rem;
    }
  }

  @media (max-width: 480px) {
    .explore-grid {
      grid-template-columns: repeat(2, 1fr);
      gap: 0.5rem;
    }
  }

  .explore-grid :global(.media-card) {
    max-width: 200px;
    width: 100%;
  }

  .load-more {
    display: flex;
    flex-direction: column;
    align-items: center;
    margin-top: 2rem;
    gap: 0.5rem;
  }

  .load-more button {
    padding: 12px 32px;
    background: linear-gradient(135deg, #6366f1, #8b5cf6);
    color: white;
    border: none;
    border-radius: 8px;
    font-size: 1rem;
    cursor: pointer;
    transition: opacity 0.2s;
  }

  .load-more button:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .load-more button:hover:not(:disabled) {
    opacity: 0.9;
  }

  .page-info {
    font-size: 0.85rem;
    color: #888;
  }

  .end-message {
    text-align: center;
    color: #666;
    margin-top: 2rem;
    font-style: italic;
  }

  .load-error {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    color: #ef4444;
    margin-top: 1rem;
    text-align: center;
  }

  .load-error button {
    background: none;
    border: none;
    color: #6366f1;
    cursor: pointer;
    text-decoration: underline;
    padding: 0;
    font-size: inherit;
  }

  @media (max-width: 767px) {
    .genre-chips {
      gap: 0.4rem;
    }
    .genre-chip {
      font-size: 0.8rem;
      padding: 0.35rem 0.85rem;
    }
  }
</style>
