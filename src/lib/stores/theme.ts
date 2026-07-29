import { writable } from 'svelte/store';
import { browser } from '$app/environment';
import { themes, applyTheme, DEFAULT_THEME, type ThemeId } from '$lib/themes';

function createThemeStore() {
  let initial: ThemeId = DEFAULT_THEME;

  if (browser) {
    const stored = localStorage.getItem('streamium-theme');
    if (stored && stored in themes) {
      initial = stored as ThemeId;
    }
  }

  const { subscribe, set, update } = writable<ThemeId>(initial);

  if (browser) {
    subscribe((themeId) => {
      const theme = themes[themeId];
      if (theme) {
        applyTheme(theme);
        localStorage.setItem('streamium-theme', themeId);
      }
    });
  }

  return {
    subscribe,
    set,
    setTheme: (id: ThemeId) => {
      if (themes[id]) set(id);
    },
    getTheme: (id: ThemeId) => themes[id],
    getAllThemes: () => Object.entries(themes).map(([id, t]) => ({ id: id as ThemeId, ...t })),
  };
}

export const themeStore = createThemeStore();
