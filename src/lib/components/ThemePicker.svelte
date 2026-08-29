<script lang="ts">
  import { themeStore } from '$lib/stores/theme';
  import { themes, type ThemeId } from '$lib/themes';

  const allThemes = Object.entries(themes)
    .filter(([, t]) => !t.hidden)
    .map(([id, t]) => ({
      id: id as ThemeId,
      ...t,
    }));

  let previewTheme = $state<ThemeId | null>(null);

  function selectTheme(id: ThemeId) {
    themeStore.setTheme(id);
  }

  function preview(id: ThemeId) {
    previewTheme = id;
  }

  function clearPreview() {
    previewTheme = null;
  }
</script>

<div class="theme-picker">
  <h2 class="tp-heading">Theme</h2>
  <p class="tp-sub">Pick your vibe. Changes apply instantly.</p>

  <div class="tp-grid">
    {#each allThemes as theme (theme.id)}
      {@const isActive = $themeStore === theme.id}
      {@const isPreview = previewTheme === theme.id}

      <button
        class="tp-card"
        class:active={isActive}
        class:preview={isPreview}
        onclick={() => selectTheme(theme.id)}
        onmouseenter={() => preview(theme.id)}
        onmouseleave={clearPreview}
        aria-label="Switch to {theme.label} theme"
      >
        <div class="tp-swatches" style="--tp-accent: {theme.accent}; --tp-bg: {theme.bg}; --tp-card: {theme.bgCard}">
          <div class="tp-swatch tp-swatch-bg"></div>
          <div class="tp-swatch tp-swatch-card"></div>
          <div class="tp-swatch tp-swatch-accent"></div>
        </div>

        <div class="tp-info">
          <span class="tp-emoji">{theme.emoji}</span>
          <span class="tp-label">{theme.label}</span>
        </div>

        {#if isActive}
          <span class="tp-check">✓</span>
        {/if}
      </button>
    {/each}
  </div>
</div>

<style>
  .theme-picker {
    width: 100%;
  }

  .tp-heading {
    font-size: 1.25rem;
    font-weight: var(--font-weight-bold, 700);
    color: var(--text-primary);
    margin: 0 0 0.35rem;
  }

  .tp-sub {
    font-size: 0.85rem;
    color: var(--text-tertiary);
    margin: 0 0 1.5rem;
  }

  .tp-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
    gap: 0.75rem;
  }

  .tp-card {
    position: relative;
    background: var(--bg-elevated);
    border: 1px solid var(--border-stream);
    border-radius: var(--radius-lg, 16px);
    padding: 1rem;
    cursor: pointer;
    transition: all var(--transition-base, 250ms);
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    text-align: left;
  }

  .tp-card:hover,
  .tp-card.preview {
    border-color: var(--accent-stream);
    transform: translateY(-2px);
    box-shadow: 0 4px 16px var(--accent-glow);
  }

  .tp-card.active {
    border-color: var(--accent-stream);
    box-shadow: 0 0 0 2px var(--accent-stream);
  }

  .tp-swatches {
    display: flex;
    gap: 4px;
  }

  .tp-swatch {
    width: 24px;
    height: 24px;
    border-radius: 6px;
  }

  .tp-swatch-bg {
    background: var(--tp-bg);
    border: 1px solid rgba(255,255,255,0.05);
  }

  .tp-swatch-card {
    background: var(--tp-card);
    border: 1px solid rgba(255,255,255,0.08);
  }

  .tp-swatch-accent {
    background: var(--tp-accent);
  }

  .tp-info {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .tp-emoji {
    font-size: 1.1rem;
  }

  .tp-label {
    font-size: 0.85rem;
    font-weight: var(--font-weight-semibold, 600);
    color: var(--text-primary);
  }

  .tp-check {
    position: absolute;
    top: 0.5rem;
    right: 0.5rem;
    width: 22px;
    height: 22px;
    border-radius: 50%;
    background: var(--accent-stream);
    color: white;
    font-size: 0.7rem;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: var(--font-weight-bold, 700);
  }

  @media (max-width: 480px) {
    .tp-grid {
      grid-template-columns: repeat(2, 1fr);
    }
  }
</style>
