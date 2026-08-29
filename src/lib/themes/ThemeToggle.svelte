<script lang="ts">
  import { themeStore } from '$lib/stores/theme';
  import { themes, type ThemeId } from '$lib/themes';

  let currentTheme = $derived(themes[$themeStore]);

  function getNextTheme(current: ThemeId): ThemeId {
    const keys = (Object.keys(themes) as ThemeId[]).filter((k) => !themes[k].hidden);
    const idx = keys.indexOf(current);
    return keys[(idx + 1) % keys.length];
  }

  let nextThemeId = $derived(getNextTheme($themeStore));
  let nextTheme = $derived(themes[nextThemeId]);

  function cycleTheme() {
    themeStore.setTheme(nextThemeId);
  }
</script>

<button
  class="theme-toggle"
  onclick={cycleTheme}
  title="Theme: {currentTheme.label} — click to cycle"
  aria-label="Change theme"
>
  <span class="theme-emoji">{currentTheme.emoji}</span>
  <span class="theme-hint">{nextTheme.emoji}</span>
</button>

<style>
  .theme-toggle {
    position: relative;
    width: 36px;
    height: 36px;
    border-radius: 50%;
    background: var(--bg-elevated);
    border: 1px solid var(--border-stream);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 1rem;
    cursor: pointer;
    transition: all var(--transition-fast, 150ms);
  }

  .theme-toggle:hover {
    border-color: var(--accent-stream);
    background: var(--bg-card);
    box-shadow: 0 0 12px var(--accent-glow);
  }

  .theme-hint {
    position: absolute;
    bottom: -2px;
    right: -2px;
    font-size: 0.55rem;
    opacity: 0;
    transition: opacity var(--transition-fast, 150ms);
  }

  .theme-toggle:hover .theme-hint {
    opacity: 1;
  }
</style>
