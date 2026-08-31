import { browser } from '$app/environment';

export const SUNE_ACCENTS = ['rose-gold', 'midnight-rose', 'crimson'] as const;
export type SuneAccent = (typeof SUNE_ACCENTS)[number];

export const SUNE_ACCENT_LABELS: Record<SuneAccent, string> = {
	'rose-gold': 'Rose Gold',
	'midnight-rose': 'Midnight Rose',
	crimson: 'Crimson'
};

const STORAGE_KEY = 'sune-accent-variant';
const DEFAULT: SuneAccent = 'rose-gold';

function read(): SuneAccent {
	if (!browser) return DEFAULT;
	try {
		const v = localStorage.getItem(STORAGE_KEY);
		if (v && (SUNE_ACCENTS as readonly string[]).includes(v)) return v as SuneAccent;
	} catch {}
	return DEFAULT;
}

function apply(accent: SuneAccent) {
	if (!browser) return;
	try {
		document.documentElement.setAttribute('data-sune-accent', accent);
		localStorage.setItem(STORAGE_KEY, accent);
	} catch {}
}

let current: SuneAccent = read();

if (browser) {
	apply(current);
	// Re-apply on load in case other code cleared it
	try {
		const stored = localStorage.getItem(STORAGE_KEY) as SuneAccent | null;
		if (stored && (SUNE_ACCENTS as readonly string[]).includes(stored)) {
			current = stored;
			apply(current);
		}
	} catch {}
}

export const suneAccentStore = {
	get current() {
		return current;
	},
	set(accent: SuneAccent) {
		if (!(SUNE_ACCENTS as readonly string[]).includes(accent)) return;
		current = accent;
		apply(accent);
	},
	init() {
		if (browser) apply(read());
	}
};

if (browser) {
	// Ensure attribute is set on first load even if called before DOM ready
	if (document.readyState === 'loading') {
		document.addEventListener('DOMContentLoaded', () => apply(current), { once: true });
	}
}
