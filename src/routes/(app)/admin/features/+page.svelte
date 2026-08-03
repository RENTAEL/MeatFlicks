<script lang="ts">
  import { FEATURES, activeFeatures, type FeatureName } from '$lib/config/features';

  let overrides: Record<string, boolean> = {};

  if (typeof window !== 'undefined') {
    const saved = localStorage.getItem('feature-overrides');
    if (saved) overrides = JSON.parse(saved);
  }

  function toggle(key: FeatureName) {
    overrides[key] = !overrides[key];
    localStorage.setItem('feature-overrides', JSON.stringify(overrides));
  }

  function enableAll() {
    for (const k of Object.keys(FEATURES)) overrides[k] = true;
    localStorage.setItem('feature-overrides', JSON.stringify(overrides));
  }

  function disableAll() {
    overrides = {};
    localStorage.removeItem('feature-overrides');
  }

  function isOn(key: FeatureName): boolean {
    return overrides[key] ?? FEATURES[key];
  }

  const featureList = Object.keys(FEATURES) as FeatureName[];

  const descriptions: Record<string, string> = {
    DISCOVERY_ENGINE: 'Mood-based browsing, AI recommendations, curated collections',
    WATCH_TRACKING: 'Sync watch history & progress via Trakt/Simkl',
    AUTO_SUBTITLES: 'Auto-fetch subtitles from Open Subtitles API',
    RATING_AGGREGATOR: 'Combine IMDb, RT & Letterboxd scores on movie cards',
    CONTENT_CALENDAR: 'Upcoming movies/shows release calendar',
    ADVANCED_SEARCH: 'Filter by genre, mood, year range, rating threshold',
    SIMILAR_TITLES: '"You might also like" section on movie pages',
    TRENDING_FEED: 'Trending/popular pulled from external aggregators',
  };
</script>

<div class="admin-panel">
  <h1>Feature Flags</h1>
  <p class="subtitle">
    Toggle features without redeploying. Save = instant.
  </p>

  <div class="actions">
    <button class="btn btn-success" onclick={enableAll}>Enable All</button>
    <button class="btn btn-danger" onclick={disableAll}>Disable All (Safe Mode)</button>
  </div>

  <div class="feature-grid">
    {#each featureList as key}
      <div class="feature-card" class:active={isOn(key)}>
        <div class="feature-header">
          <h3>{key.replace(/_/g, ' ')}</h3>
          <button
            class="toggle"
            class:on={isOn(key)}
            onclick={() => toggle(key)}
            aria-label="Toggle {key}"
          >
            <span class="toggle-knob"></span>
          </button>
        </div>
        <p class="feature-desc">{descriptions[key]}</p>
        <code class="feature-status">
          {isOn(key) ? 'ACTIVE' : 'INACTIVE'}
          {overrides[key] !== undefined ? ' (overridden)' : ''}
        </code>
      </div>
    {/each}
  </div>

  <div class="revert-section">
    <h2>Emergency Revert</h2>
    <p>
      Add <code>?features=revert</code> to any page URL to
      instantly disable ALL new features and run the old code.
      No deploy needed.
    </p>
    <a href="/?features=revert" class="btn btn-warning">
      Go to Safe Mode →
    </a>
  </div>
</div>

<style>
  .admin-panel {
    max-width: 900px;
    margin: 2rem auto;
    padding: 1.5rem;
    color: var(--text-primary);
  }
  h1 { font-size: 1.75rem; margin-bottom: 0.25rem; }
  .subtitle { color: var(--text-secondary); margin-bottom: 2rem; }
  .actions {
    display: flex;
    gap: 0.75rem;
    margin-bottom: 2rem;
    flex-wrap: wrap;
  }
  .btn {
    padding: 0.6rem 1.2rem;
    border: none;
    border-radius: 10px;
    cursor: pointer;
    font-weight: 600;
    font-size: 0.85rem;
    text-decoration: none;
    display: inline-block;
  }
  .btn-success { background: #22c55e; color: #000; }
  .btn-danger { background: #ef4444; color: #fff; }
  .btn-warning { background: #f59e0b; color: #000; }
  .feature-grid {
    display: grid;
    gap: 1rem;
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
    margin-bottom: 3rem;
  }
  .feature-card {
    background: var(--bg-elevated, #1a1a2e);
    border: 1px solid var(--border, #2a2a3e);
    border-radius: 14px;
    padding: 1.25rem;
    transition: border-color 0.2s;
  }
  .feature-card.active {
    border-color: #22c55e;
  }
  .feature-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 0.5rem;
  }
  .feature-header h3 {
    font-size: 0.95rem;
    text-transform: capitalize;
    margin: 0;
  }
  .feature-desc {
    font-size: 0.8rem;
    color: var(--text-secondary);
    margin-bottom: 0.75rem;
    line-height: 1.4;
  }
  .feature-status {
    font-size: 0.75rem;
    color: var(--text-tertiary);
  }
  .toggle {
    width: 48px;
    height: 26px;
    border-radius: 13px;
    border: none;
    background: #3a3a4e;
    cursor: pointer;
    position: relative;
    transition: background 0.2s;
  }
  .toggle.on { background: #22c55e; }
  .toggle-knob {
    position: absolute;
    top: 3px;
    left: 3px;
    width: 20px;
    height: 20px;
    border-radius: 50%;
    background: white;
    transition: transform 0.2s;
  }
  .toggle.on .toggle-knob { transform: translateX(22px); }
  .revert-section {
    background: #2a1a1a;
    border: 1px solid #5a2a2a;
    border-radius: 14px;
    padding: 1.5rem;
  }
  .revert-section h2 { margin-top: 0; }
  .revert-section code {
    background: #3a2a2a;
    padding: 0.15rem 0.4rem;
    border-radius: 4px;
    font-size: 0.85rem;
  }
</style>
