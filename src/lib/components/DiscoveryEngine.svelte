<script lang="ts">
  import { isEnabled } from '$lib/config/features';

  let { currentMovie = null }: { currentMovie: { id: number; title: string; genres?: string[] } | null } = $props();

  let moods = [
    { emoji: '😱', label: 'Thriller', icon: '🔪' },
    { emoji: '😂', label: 'Comedy', icon: '🎭' },
    { emoji: '😢', label: 'Drama', icon: '🎬' },
    { emoji: '❤️', label: 'Romance', icon: '💕' },
    { emoji: '🤖', label: 'Sci-Fi', icon: '🚀' },
    { emoji: '👻', label: 'Horror', icon: '🩸' },
    { emoji: '🥋', label: 'Action', icon: '💥' },
    { emoji: '🤔', label: 'Mystery', icon: '🔍' },
    { emoji: '🎲', label: 'Surprise Me', icon: '✨' },
  ];

  let activeMood = $state('');
  let recommendations = $state<any[]>([]);
  let loading = $state(false);

  async function pickMood(mood: string) {
    if (!isEnabled('DISCOVERY_ENGINE')) return;
    activeMood = mood;
    loading = true;
    try {
      const res = await fetch(`/api/discover?mood=${encodeURIComponent(mood)}`);
      if (!res.ok) throw new Error('Discovery API failed');
      recommendations = await res.json();
    } catch (e) {
      console.warn('[DiscoveryEngine] Mood fetch failed:', e);
      recommendations = [];
    } finally {
      loading = false;
    }
  }
</script>

{#if isEnabled('DISCOVERY_ENGINE')}
  <section class="discovery-engine">
    <h2>What's Your Mood?</h2>
    <div class="mood-grid">
      {#each moods as mood}
        <button
          class="mood-chip"
          class:active={activeMood === mood.label}
          onclick={() => pickMood(mood.label)}
        >
          <span class="mood-icon">{mood.icon}</span>
          <span class="mood-label">{mood.label}</span>
        </button>
      {/each}
    </div>

    {#if loading}
      <div class="loading-skeleton">
        {#each Array(6) as _}
          <div class="skeleton-card" />
        {/each}
      </div>
    {:else if recommendations.length > 0}
      <div class="recs-grid">
        {#each recommendations as movie}
          <a href="/movie/{movie.id}" class="rec-card">
            <img src={movie.poster} alt={movie.title} loading="lazy" />
            <span class="rec-title">{movie.title}</span>
          </a>
        {/each}
      </div>
    {/if}
  </section>
{/if}

<style>
  .discovery-engine {
    margin: 2rem 0;
  }
  .discovery-engine h2 {
    font-size: 1.3rem;
    margin-bottom: 1rem;
    color: var(--text-primary);
  }
  .mood-grid {
    display: flex;
    flex-wrap: wrap;
    gap: 0.6rem;
    margin-bottom: 1.5rem;
  }
  .mood-chip {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    padding: 0.6rem 1rem;
    border-radius: 50px;
    border: 1px solid var(--border);
    background: var(--bg-elevated);
    color: var(--text-primary);
    cursor: pointer;
    transition: all 0.2s;
    font-size: 0.85rem;
  }
  .mood-chip:hover, .mood-chip.active {
    background: var(--accent-glow);
    border-color: var(--accent);
    transform: scale(1.03);
  }
  .mood-icon { font-size: 1.1rem; }
  .recs-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
    gap: 0.75rem;
  }
  .rec-card {
    text-decoration: none;
    color: var(--text-primary);
    transition: transform 0.2s;
  }
  .rec-card:hover { transform: scale(1.04); }
  .rec-card img {
    width: 100%;
    aspect-ratio: 2/3;
    object-fit: cover;
    border-radius: 10px;
  }
  .rec-title {
    display: block;
    font-size: 0.8rem;
    margin-top: 0.4rem;
    text-align: center;
  }
  .loading-skeleton {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
    gap: 0.75rem;
  }
  .skeleton-card {
    aspect-ratio: 2/3;
    background: var(--bg-elevated);
    border-radius: 10px;
    animation: pulse 1.5s infinite;
  }
  @keyframes pulse {
    0%, 100% { opacity: 0.4; }
    50% { opacity: 0.8; }
  }
</style>
