<script lang="ts">
  import { isEnabled } from '$lib/config/features';

  let { rating = 0, imdbId = '' }: { rating: string | number; imdbId: string } = $props();

  let rtRating = $state<string | null>(null);
  let metaRating = $state<string | null>(null);

  $effect(() => {
    if (isEnabled('RATING_AGGREGATOR') && imdbId) {
      fetchAggregatedRatings(imdbId);
    }
  });

  async function fetchAggregatedRatings(id: string) {
    try {
      const res = await fetch(`/api/ratings?imdbId=${id}`);
      if (!res.ok) return;
      const data = await res.json();
      const rt = data.ratings?.find((r: any) => r.Source === 'Rotten Tomatoes');
      const mc = data.ratings?.find((r: any) => r.Source === 'Metacritic');
      rtRating = rt?.Value || null;
      metaRating = mc?.Value || null;
    } catch {
      // Ratings are decorative — failure is fine
    }
  }
</script>

{#if isEnabled('RATING_AGGREGATOR')}
  <div class="aggregated-ratings">
    <span class="rating imdb" title="IMDb">&#11088; {rating}</span>
    {#if rtRating}
      <span class="rating rt" title="Rotten Tomatoes">&#127813; {rtRating}</span>
    {/if}
    {#if metaRating}
      <span class="rating meta" title="Metacritic">&#128202; {metaRating}</span>
    {/if}
  </div>
{:else}
  <span class="rating">&#11088; {rating}</span>
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
