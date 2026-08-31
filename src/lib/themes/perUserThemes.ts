import { themes, type ThemeId, type ThemeColors } from './index';

// Per-user theme registry — Sune stays as-is, other users get distinct premium themes
// Keyed by normalized username (lowercase)
const USER_THEME_MAP: Record<string, ThemeId> = {
	sune: 'sune',
	ghostbunny_779: 'steel',
	cocolemon: 'sofia',
	user: 'graphite',
	aftermidnight: 'demon_slayer',
	user2: 'midnight_neon'
};

// For any other user not in the explicit map, generate a deterministic distinct theme
// based on username hash — ensures every user looks unique, no two the same.

function hashString(input: string): number {
	let hash = 5381;
	for (let i = 0; i < input.length; i++) hash = (hash * 33) ^ input.charCodeAt(i);
	return hash >>> 0;
}

// Palette for generated per-user themes — each entry is distinct, premium, hidden
const GENERATED_PALETTES: Array<{
	accent: string;
	accentHover: string;
	bg: string;
	bgCard: string;
	gradient: string;
	emoji: string;
}> = [
	{
		accent: '#f59e0b',
		accentHover: '#fbbf24',
		bg: '#1a1408',
		bgCard: '#241a0c',
		gradient: 'linear-gradient(135deg, #b45309 0%, #f59e0b 50%, #fde68a 100%)',
		emoji: '🔥'
	},
	{
		accent: '#06b6d4',
		accentHover: '#22d3ee',
		bg: '#0c1a1e',
		bgCard: '#132a30',
		gradient: 'linear-gradient(135deg, #0e7490 0%, #06b6d4 50%, #a5f3fc 100%)',
		emoji: '🌊'
	},
	{
		accent: '#8b5cf6',
		accentHover: '#a78bfa',
		bg: '#150c1e',
		bgCard: '#1e1430',
		gradient: 'linear-gradient(135deg, #5b21b6 0%, #8b5cf6 50%, #ddd6fe 100%)',
		emoji: '🔮'
	},
	{
		accent: '#ec4899',
		accentHover: '#f472b6',
		bg: '#1a0c14',
		bgCard: '#2a1430',
		gradient: 'linear-gradient(135deg, #9d174d 0%, #ec4899 50%, #f9a8d4 100%)',
		emoji: '💖'
	},
	{
		accent: '#10b981',
		accentHover: '#34d399',
		bg: '#0c1a14',
		bgCard: '#143020',
		gradient: 'linear-gradient(135deg, #065f46 0%, #10b981 50%, #a7f3d0 100%)',
		emoji: '🌿'
	},
	{
		accent: '#f97316',
		accentHover: '#fb923c',
		bg: '#1a0f0c',
		bgCard: '#2a1a0c',
		gradient: 'linear-gradient(135deg, #9a3412 0%, #f97316 50%, #fed7aa 100%)',
		emoji: '🍂'
	}
];

// Cache for generated per-user themes
const generatedCache = new Map<string, ThemeId>();

export function getThemeForUser(username: string | null | undefined): ThemeId | null {
	if (!username) return null;
	const key = username.trim().toLowerCase();
	if (!key) return null;
	if (USER_THEME_MAP[key]) return USER_THEME_MAP[key];

	// Check if already generated
	if (generatedCache.has(key)) return generatedCache.get(key)!;

	// Generate deterministic theme for this user
	const hash = hashString(key);
	const palette = GENERATED_PALETTES[hash % GENERATED_PALETTES.length];
	// Create a unique theme id for this user — hidden, per-user
	const themeId = `peruser_${hash.toString(36).slice(0, 6)}` as ThemeId;

	// If not already in themes, create it
	if (!themes[themeId as ThemeId]) {
		const base = themes['dark'];
		// Create a distinct theme by overriding accent/bg/gradient
		const newTheme: ThemeColors = {
			...base,
			name: themeId,
			label: username.charAt(0).toUpperCase() + username.slice(1),
			emoji: palette.emoji,
			hidden: true,
			bg: palette.bg,
			bgCard: palette.bgCard,
			bgElevated: palette.bgCard,
			bgInput: palette.bg,
			accent: palette.accent,
			accentHover: palette.accentHover,
			accentGlow: `${palette.accent}40`,
			gradientBrand: palette.gradient,
			gradientBrandHorizontal: palette.gradient,
			border: `${palette.accent}1a`,
			borderStrong: `${palette.accent}33`
		};
		// Register dynamically
		(themes as Record<string, ThemeColors>)[themeId] = newTheme;
	}
	generatedCache.set(key, themeId as ThemeId);
	return themeId as ThemeId;
}

export function getThemeForBrandingUser(user: { displayName: string | null; email: string | null } | null | undefined): ThemeId | null {
	if (!user) return null;
	const candidates = [user.displayName, user.email?.split('@')[0] ?? null, user.email];
	for (const c of candidates) {
		const theme = getThemeForUser(c);
		if (theme) return theme;
	}
	return null;
}

export function getSwatchForUser(username: string | null | undefined): { bg: string; accent: string; gradient: string } | null {
	const themeId = getThemeForUser(username);
	if (!themeId || !themes[themeId]) return null;
	const t = themes[themeId];
	return { bg: t.bg, accent: t.accent, gradient: t.gradientBrand };
}
