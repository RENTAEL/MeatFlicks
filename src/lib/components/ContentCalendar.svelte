<script lang="ts">
  import { isEnabled } from '$lib/config/features';

  let upcoming = $state<any[]>([]);
  let loading = $state(true);

  $effect(() => {
    if (isEnabled('CONTENT_CALENDAR')) {
      loadUpcoming();
    }
  });

  async function loadUpcoming() {
    try {
      const res = await fetch(`/api/tmdb/upcoming`);
      if (!res.ok) throw new Error('Failed');
      const data = await res.json();
      upcoming = (data.results || []).slice(0, 10);
    } catch {
      // Calendar is non-critical
    } finally {
      loading = false;
    }
  }

  function formatDate(dateStr: string): string {
    if (!dateStr) return 'TBA';
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }
</script>

{#if isEnabled('CONTENT_CALENDAR') && upcoming.length > 0}
  <section class="calendar-section">
    <h2>Coming Soon</h2>
    <div class="calendar-scroll">
      {#each upcoming as movie}
        <div class="calendar-card">
          <img
            src={movie.poster_path
              ? `https://image.tmdb.org/t/p/w185${movie.poster_path}`
              : '/placeholder-poster.svg'}
            alt={movie.title}
            loading="lazy"
          />
          <span class="cal-title">{movie.title}</span>
          <span class="cal-date">{formatDate(movie.release_date)}</span>
        </div>
      {/each}
    </div>
  </section>
{/if}

<style>
  .calendar-section {
    margin: 2rem 0;
  }
  .calendar-section h2 {
    font-size: 1.3rem;
    margin-bottom: 1rem;
    color: var(--text-primary);
  }
  .calendar-scroll {
    display: flex;
    gap: 0.75rem;
    overflow-x: auto;
    padding-bottom: 0.5rem;
    scroll-snap-type: x mandatory;
    -webkit-overflow-scrolling: touch;
  }
  .calendar-card {
    flex: 0 0 120px;
    scroll-snap-align: start;
    text-align: center;
  }
  .calendar-card img {
    width: 100%;
    aspect-ratio: 2/3;
    object-fit: cover;
    border-radius: 10px;
  }
  .cal-title {
    display: block;
    font-size: 0.75rem;
    margin-top: 0.35rem;
    color: var(--text-primary);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .cal-date {
    font-size: 0.7rem;
    color: var(--text-tertiary);
  }
</style>
