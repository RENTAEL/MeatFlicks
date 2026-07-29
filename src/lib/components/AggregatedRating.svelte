<script lang="ts">
  import { isEnabled } from '$lib/config/features';

  let { imdbRating = 0, imdbId = '' }: { imdbRating: string | number; imdbId: string } = $props();

  let rtRating = $state<string | null>(null);
  let metaRating = $state<string | null>(null);

  $effect(() => {
    if (isEnabled('RATING_AGGREGATOR') && imdbId) {
      fetchAggregatedRatings(imdbId);
    }
  });

  async function fetchAggregatedRatings(id: string) {
    try {
      const key = 'FAKE_KEY';
      const res = await fetch(`https://www.omdbapi.com/?i=${id}&apikey=${key}`);
      if (!res.ok) return;
      const data = await res.json();
      const ratings: any[] = data.Ratings || [];
      const rt = ratings.find((r: any) => r.Source === 'Rotten Tomatoes');
      const mc = ratings.find((r: any) => r.Source === 'Metacritic');
      rtRating = rt?.Value || null;
      metaRating = mc?.Value || null;
    } catch {
      // Ratings are decorative — failure is fine
    }
  }
</script>

{#if isEnabled('RATING_AGGREGATOR')}
  <div class="aggregated-ratings">
    <span class="rating imdb" title="IMDb">
      ⭐ {imdbRating}
    </span>
    {#if rtRating}
      <span class="rating rt" title="Rotten Tomatoes">
        🍅 {rtRating}
      </span>
    {/if}
    {#if metaRating}
      <span class="rating meta" title="Metacritic">
        📊 {metaRating}
      </span>
    {/if}
  </div>
{:else}
  <span class="rating">⭐ {imdbRating}</span>
{/if}

<style>
  .aggregated-ratings {
    display: flex;
    gap: 1rem;
    align-items: center;
    flex-wrap: wrap;
  }
  .rating {
    font-size: 0.9rem;
    font-weight: 600;
    padding: 0.25rem 0.6rem;
    border-radius: 6px;
    background: var(--bg-elevated);
  }
  .rating.imdb { color: #f5c518; }
  .rating.rt { color: #fa320a; }
  .rating.meta { color: #66cc33; }
</style>
