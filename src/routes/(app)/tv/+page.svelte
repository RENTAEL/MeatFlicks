<script lang="ts">
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import { fly } from 'svelte/transition';

  let shows = $derived($page.data?.shows ?? []);
  let currentQuery = $derived($page.data?.query ?? '');

  let searchInput = $state('');
  let debounceTimer: ReturnType<typeof setTimeout> | undefined;

  $effect(() => {
    searchInput = currentQuery;
  });

  function onInput() {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      const trimmed = searchInput.trim();
      if (trimmed) {
        goto(`/tv?q=${encodeURIComponent(trimmed)}`, { replaceState: true, noScroll: true });
      } else {
        goto('/tv', { replaceState: true, noScroll: true });
      }
    }, 400);
  }

  function clearSearch() {
    searchInput = '';
    goto('/tv', { replaceState: true, noScroll: true });
  }

  function onKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter') {
      clearTimeout(debounceTimer);
      const trimmed = searchInput.trim();
      if (trimmed) {
        goto(`/tv?q=${encodeURIComponent(trimmed)}`, { noScroll: true });
      }
    }
  }
</script>

<div class="tv-page" in:fly={{ y: 12, duration: 250 }}>
  <div class="search-section">
    <div class="search-wrapper">
      <svg class="search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="11" cy="11" r="8" />
        <path d="m21 21-4.35-4.35" />
      </svg>

      <input
        type="search"
        class="search-input"
        bind:value={searchInput}
        oninput={onInput}
        onkeydown={onKeydown}
        placeholder="Search TV series..."
        autocomplete="off"
        aria-label="Search TV series"
      />

      {#if searchInput}
        <button class="search-clear" onclick={clearSearch} aria-label="Clear search">
          ✕
        </button>
      {/if}
    </div>

    {#if currentQuery}
      <p class="search-info">
        Results for <strong>"{currentQuery}"</strong>
        <button class="search-clear-link" onclick={clearSearch}>Clear</button>
      </p>
    {/if}
  </div>

  {#if shows.length > 0}
    <div class="show-grid">
      {#each shows as show (show.id)}
        <a href="/tv/{show.id}" class="show-card glass">
          <div class="show-poster">
            {#if show.poster_path}
              <img
                src="https://image.tmdb.org/t/p/w342{show.poster_path}"
                alt={show.name}
                loading="lazy"
              />
            {:else}
              <div class="show-poster-placeholder">
                <span>{show.name?.[0] || '?'}</span>
              </div>
            {/if}
            {#if show.vote_average}
              <span class="show-rating">★ {show.vote_average.toFixed(1)}</span>
            {/if}
          </div>
          <div class="show-info">
            <h3 class="show-title">{show.name}</h3>
            <p class="show-year">{show.first_air_date?.split('-')[0] || '—'}</p>
          </div>
        </a>
      {/each}
    </div>
  {:else}
    <div class="empty-state">
      {#if currentQuery}
        <p class="empty-title">No results for "{currentQuery}"</p>
        <p class="empty-sub">Try a different search or browse all TV series.</p>
        <button class="btn btn-secondary" onclick={clearSearch}>Browse All</button>
      {:else}
        <p class="empty-title">No TV series available</p>
        <p class="empty-sub">Check back later for new content.</p>
      {/if}
    </div>
  {/if}

  {#if $page.data?.totalPages > 1}
    <div class="pagination">
      {#if $page.data.page > 1}
        <a href="/tv?page={$page.data.page - 1}{currentQuery ? `&q=${currentQuery}` : ''}" class="btn btn-secondary">
          ← Previous
        </a>
      {/if}
      <span class="page-info">Page {$page.data.page} of {$page.data.totalPages}</span>
      {#if $page.data.page < $page.data.totalPages}
        <a href="/tv?page={$page.data.page + 1}{currentQuery ? `&q=${currentQuery}` : ''}" class="btn btn-secondary">
          Next →
        </a>
      {/if}
    </div>
  {/if}
</div>

<style>
  .tv-page {
    max-width: 1400px;
    margin: 0 auto;
    padding: 1.5rem 1rem;
    padding-top: calc(var(--header-height, 64px) + 1.5rem);
  }

  .search-section {
    margin-bottom: 2rem;
  }

  .search-wrapper {
    position: relative;
    max-width: 520px;
  }

  .search-icon {
    position: absolute;
    left: 1rem;
    top: 50%;
    transform: translateY(-50%);
    width: 18px;
    height: 18px;
    color: var(--text-tertiary, #66667a);
    pointer-events: none;
  }

  .search-input {
    width: 100%;
    padding: 0.75rem 2.75rem 0.75rem 2.75rem;
    background: var(--bg-input, #1a1a25);
    border: 1px solid var(--border, rgba(255,255,255,0.06));
    border-radius: var(--radius-lg, 16px);
    color: var(--text-primary, #f1f1f7);
    font-size: 0.95rem;
    transition: border-color 0.2s, box-shadow 0.2s;
    outline: none;
  }

  .search-input::placeholder {
    color: var(--text-tertiary, #66667a);
  }

  .search-input:focus {
    border-color: var(--accent, #7c5cfc);
    box-shadow: 0 0 0 3px var(--accent-glow, rgba(124,92,252,0.2));
  }

  .search-clear {
    position: absolute;
    right: 0.75rem;
    top: 50%;
    transform: translateY(-50%);
    width: 28px;
    height: 28px;
    border-radius: 50%;
    border: none;
    background: var(--bg-elevated, #22222d);
    color: var(--text-secondary, #9898ab);
    font-size: 0.75rem;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: background 0.15s;
  }

  .search-clear:hover {
    background: var(--accent, #7c5cfc);
    color: white;
  }

  .search-info {
    font-size: 0.85rem;
    color: var(--text-secondary, #9898ab);
    margin-top: 0.75rem;
  }

  .search-info strong {
    color: var(--text-primary, #f1f1f7);
  }

  .search-clear-link {
    background: none;
    border: none;
    color: var(--accent, #7c5cfc);
    cursor: pointer;
    font-size: 0.85rem;
    margin-left: 0.5rem;
    text-decoration: underline;
    padding: 0;
  }

  .show-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(170px, 1fr));
    gap: 1rem;
  }

  .show-card {
    display: block;
    text-decoration: none;
    border-radius: var(--radius-lg, 16px);
    overflow: hidden;
    transition: transform 0.2s, box-shadow 0.2s;
  }

  .show-card:hover {
    transform: translateY(-4px);
    box-shadow: var(--shadow-md, 0 4px 16px rgba(0,0,0,0.4));
  }

  .show-poster {
    position: relative;
    aspect-ratio: 2 / 3;
    background: var(--bg-card, #18181f);
    overflow: hidden;
  }

  .show-poster img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .show-poster-placeholder {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 2.5rem;
    font-weight: 700;
    background: var(--gradient-brand, linear-gradient(135deg, #7c5cfc, #c94b8c));
    color: white;
  }

  .show-rating {
    position: absolute;
    top: 0.5rem;
    right: 0.5rem;
    padding: 0.2rem 0.5rem;
    border-radius: 99px;
    background: rgba(0,0,0,0.7);
    color: #fbbf24;
    font-size: 0.75rem;
    font-weight: 600;
  }

  .show-info {
    padding: 0.75rem;
  }

  .show-title {
    font-size: 0.9rem;
    font-weight: 600;
    color: var(--text-primary, #f1f1f7);
    margin: 0;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .show-year {
    font-size: 0.78rem;
    color: var(--text-tertiary, #66667a);
    margin: 0.2rem 0 0;
  }

  .empty-state {
    text-align: center;
    padding: 4rem 1rem;
  }

  .empty-title {
    font-size: 1.15rem;
    font-weight: 600;
    color: var(--text-primary, #f1f1f7);
    margin: 0 0 0.5rem;
  }

  .empty-sub {
    color: var(--text-secondary, #9898ab);
    margin: 0 0 1.5rem;
  }

  .pagination {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 1rem;
    margin-top: 2rem;
    padding: 1rem 0;
  }

  .page-info {
    font-size: 0.85rem;
    color: var(--text-secondary, #9898ab);
  }

  @media (max-width: 640px) {
    .show-grid {
      grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
      gap: 0.75rem;
    }
  }
</style>
