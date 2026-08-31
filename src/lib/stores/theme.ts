import { writable } from 'svelte/store';
import { browser } from '$app/environment';
import { setTheme as setModeWatcherTheme } from 'mode-watcher';
import {
	themes,
	applyTheme,
	DEFAULT_THEME,
	SOFIA_THEME,
	DEMON_SLAYER_THEME,
	MIDNIGHT_NEON_THEME,
	SUNE_THEME,
	STEEL_THEME,
	AMBER_THEME,
	GRAPHITE_THEME,
	shade,
	alpha,
	type ThemeColors,
	type ThemeId
} from '$lib/themes';
import { getThemeForUser } from '$lib/themes/perUserThemes';
import type { BrandingType } from '$lib/utils/branding';

/**
 * The localStorage key holds the user's EXPLICIT preset choice only. Without
 * one, the effective theme falls back to the brand default (Sofia for the
 * cocolemon/Sofia brand, otherwise the standard dark preset), so the series
 * look is the default and any custom pick overrides it.
 */
const CHOICE_KEY = 'streamium-theme';
const OVERRIDE_KEY = 'streamium-theme-overrides';

export type OverrideToken = 'accent' | 'bg' | 'textPrimary';
export type ThemeOverrides = Partial<Record<OverrideToken, string>>;

const THEME_TOKENS: Record<OverrideToken, true> = { accent: true, bg: true, textPrimary: true };

function readChoice(): ThemeId | null {
	if (!browser) return null;
	const stored = localStorage.getItem(CHOICE_KEY);
	return stored && stored in themes ? (stored as ThemeId) : null;
}

function readOverrides(): ThemeOverrides {
	if (!browser) return {};
	try {
		const parsed = JSON.parse(localStorage.getItem(OVERRIDE_KEY) ?? '{}');
		if (!parsed || typeof parsed !== 'object') return {};
		const overrides: ThemeOverrides = {};
		for (const [token, value] of Object.entries(parsed as Record<string, unknown>)) {
			const v = typeof value === 'string' ? value.trim() : '';
			if (token in THEME_TOKENS && v) overrides[token as OverrideToken] = v;
		}
		return overrides;
	} catch {
		return {};
	}
}

function createThemeStore() {
	let choice: ThemeId | null = readChoice();
	let brandDefault: ThemeId = DEFAULT_THEME;
	let overrides: ThemeOverrides = readOverrides();
	let brandPreview: BrandingType | null = null;

	const effectiveId = (): ThemeId => {
		if (brandPreview === 'sofia') return SOFIA_THEME;
		if (brandPreview === 'demon_slayer') return DEMON_SLAYER_THEME;
		if (brandPreview === 'midnight_neon') return MIDNIGHT_NEON_THEME;
		if (brandPreview === 'sune') return SUNE_THEME;
		if (brandPreview === 'midnight') return STEEL_THEME;
		if (brandPreview === 'custom') return GRAPHITE_THEME;
		// per-user generated themes are stored as brandPreview being the username hash id
		// e.g. peruser_abc123 — check if it's a known theme
		if (brandPreview && themes[brandPreview as ThemeId]) return brandPreview as ThemeId;
		return choice ?? brandDefault;
	};

	function applyCurrent() {
		if (!browser) return;
		const base = themes[effectiveId()];
		if (!base) return;
		const merged: ThemeColors = { ...base };
		if (overrides.accent) {
			merged.accent = overrides.accent;
			merged.accentHover = shade(overrides.accent, 1.15);
			merged.accentGlow = alpha(overrides.accent, 0.25);
		}
		if (overrides.bg) {
			merged.bg = overrides.bg;
			merged.bgCard = shade(overrides.bg, 1.14);
			merged.bgElevated = shade(overrides.bg, 1.3);
			merged.bgInput = shade(overrides.bg, 1.06);
		}
		if (overrides.textPrimary) {
			merged.textPrimary = overrides.textPrimary;
			merged.textSecondary = shade(overrides.textPrimary, 0.66);
			merged.textTertiary = shade(overrides.textPrimary, 0.48);
		}
		applyTheme(merged);
		// mode-watcher's derived theme writes data-theme from its customTheme;
		// push our theme name so the attribute always reflects the applied theme.
		setModeWatcherTheme(merged.name);
	}

	const { subscribe, set } = writable<ThemeId>(effectiveId());

	subscribe(() => {
		applyCurrent();
	});

	return {
		subscribe,
		setTheme: (id: ThemeId) => {
			if (!themes[id]) return;
			choice = id;
			if (browser) localStorage.setItem(CHOICE_KEY, id);
			set(effectiveId());
		},
		setBrandTheme: (brand: BrandingType | null, preview = false) => {
			const nextPreview = preview ? brand : null;
			let nextDefault: ThemeId = DEFAULT_THEME;
			if (brand === 'sofia') nextDefault = SOFIA_THEME;
			else if (brand === 'demon_slayer') nextDefault = DEMON_SLAYER_THEME;
			else if (brand === 'midnight_neon') nextDefault = MIDNIGHT_NEON_THEME;
			else if (brand === 'sune') nextDefault = SUNE_THEME;
			else if (brand === 'midnight') nextDefault = STEEL_THEME;
			else if (brand === 'custom') nextDefault = GRAPHITE_THEME;
			if (nextPreview === brandPreview && nextDefault === brandDefault) return;
			brandPreview = nextPreview;
			brandDefault = nextDefault;
			set(effectiveId());
		},
		setUserTheme: (username: string | null, preview = false) => {
			if (!username) {
				// No user — fallback to default
				if (preview) brandPreview = null;
				else brandDefault = DEFAULT_THEME;
				set(effectiveId());
				return;
			}
			const themeId = getThemeForUser(username);
			if (!themeId) return;
			if (preview) {
				if (brandPreview === themeId) return;
				brandPreview = themeId as BrandingType;
			} else {
				if (brandDefault === themeId) return;
				brandDefault = themeId;
			}
			set(effectiveId());
		},
		resetBrandTheme: () => {
			choice = null;
			overrides = {};
			if (browser) {
				localStorage.removeItem(CHOICE_KEY);
				localStorage.removeItem(OVERRIDE_KEY);
			}
			set(effectiveId());
			// The effective id may be unchanged (writable skips equal values), so
			// re-apply explicitly to drop the cleared overrides.
			applyCurrent();
		},
		setOverride: (token: OverrideToken, value: string) => {
			const v = value.trim();
			if (!v) {
				delete overrides[token];
				if (browser) localStorage.setItem(OVERRIDE_KEY, JSON.stringify(overrides));
				applyCurrent();
				return;
			}
			overrides[token] = v;
			if (browser) localStorage.setItem(OVERRIDE_KEY, JSON.stringify(overrides));
			applyCurrent();
		},
		clearOverride: (token: OverrideToken) => {
			delete overrides[token];
			if (browser) localStorage.setItem(OVERRIDE_KEY, JSON.stringify(overrides));
			applyCurrent();
		},
		getOverrides: () => overrides,
		hasExplicitChoice: () => choice !== null,
		getEffective: () => themes[effectiveId()]
	};
}

export const themeStore = createThemeStore();
