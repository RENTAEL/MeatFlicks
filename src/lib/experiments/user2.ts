import { browser } from '$app/environment';

export type User2Experiment =
	| 'midnightNeon'
	| 'konami'
	| 'logoEaster'
	| 'surpriseMe'
	| 'timeSinceJoined'
	| 'streak'
	| 'rotatingTagline'
	| 'cursorTrail'
	| 'moodSelector'
	| 'progressBar';

const STORAGE_KEY = 'user2-experiments-disabled';
const GLOBAL_DISABLED_KEY = 'global-experiments-disabled';
const MOOD_KEY = 'user2-mood';
const STREAK_KEY = 'user2-streak';
const STREAK_DATE_KEY = 'user2-streak-last-date';

function normalize(name: string | null | undefined): string | null {
	if (!name) return null;
	return name.trim().toLowerCase() || null;
}

export function isUser2(
	user:
		| { username?: string | null; displayName?: string | null; email?: string | null }
		| null
		| undefined
): boolean {
	if (!user) return false;
	const candidates = [user.username, (user as any).displayName, user.email?.split('@')[0]];
	for (const c of candidates) {
		if (normalize(c) === 'user2') return true;
	}
	return false;
}

function getDisabled(): Set<User2Experiment> {
	if (!browser) return new Set();
	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		if (!raw) return new Set();
		const arr = JSON.parse(raw) as string[];
		return new Set(arr as User2Experiment[]);
	} catch {
		return new Set();
	}
}

export function isExperimentEnabled(user: unknown, exp: User2Experiment): boolean {
	if (!isUser2(user as any)) return false;
	return !getDisabled().has(exp);
}

export function setExperimentEnabled(exp: User2Experiment, enabled: boolean) {
	if (!browser) return;
	const disabled = getDisabled();
	if (enabled) disabled.delete(exp);
	else disabled.add(exp);
	localStorage.setItem(STORAGE_KEY, JSON.stringify([...disabled]));
}

// Global experiments - now live for all users
export type GlobalExperiment = 'surpriseMe' | 'timeSinceJoined' | 'streak' | 'rotatingTagline' | 'cursorTrail' | 'moodSelector' | 'progressBar';

function getGlobalDisabled(): Set<string> {
	if (!browser) return new Set();
	try {
		const raw = localStorage.getItem(GLOBAL_DISABLED_KEY);
		if (!raw) return new Set();
		return new Set(JSON.parse(raw) as string[]);
	} catch {
		return new Set();
	}
}

export function isGlobalExperimentEnabled(exp: GlobalExperiment, user?: unknown): boolean {
	// For per-user toggleable ones, check per-user disabled
	if (exp === 'streak' || exp === 'moodSelector' || exp === 'cursorTrail') {
		const userId = (user as any)?.id ?? (user as any)?.username ?? null;
		if (userId && browser) {
			const key = `global-${exp}-disabled-${userId}`;
			if (localStorage.getItem(key) === '1') return false;
		}
		return !getGlobalDisabled().has(exp);
	}
	return !getGlobalDisabled().has(exp);
}

export function setGlobalExperimentEnabled(exp: GlobalExperiment, enabled: boolean, user?: unknown) {
	if (!browser) return;
	if (exp === 'streak' || exp === 'moodSelector' || exp === 'cursorTrail') {
		const userId = (user as any)?.id ?? (user as any)?.username ?? null;
		if (userId) {
			const key = `global-${exp}-disabled-${userId}`;
			if (enabled) localStorage.removeItem(key);
			else localStorage.setItem(key, '1');
			return;
		}
	}
	const disabled = getGlobalDisabled();
	if (enabled) disabled.delete(exp);
	else disabled.add(exp);
	localStorage.setItem(GLOBAL_DISABLED_KEY, JSON.stringify([...disabled]));
}

// Mood - per-user
export const MOODS = ['😎', '🥱', '😭', '🤯'] as const;
export type Mood = (typeof MOODS)[number];

function moodKey(user?: unknown): string {
	const userId = (user as any)?.id ?? (user as any)?.username ?? null;
	return userId ? `${MOOD_KEY}-${userId}` : MOOD_KEY;
}

export function getMood(user?: unknown): Mood | null {
	if (!browser) return null;
	const key = moodKey(user);
	const v = localStorage.getItem(key) as Mood | null;
	if (v && (MOODS as readonly string[]).includes(v)) return v;
	// Fallback to legacy global key for migration
	if (!user) {
		const legacy = localStorage.getItem(MOOD_KEY) as Mood | null;
		return legacy && (MOODS as readonly string[]).includes(legacy) ? legacy : null;
	}
	return null;
}

export function setMood(mood: Mood | null, user?: unknown) {
	if (!browser) return;
	const key = moodKey(user);
	if (mood) localStorage.setItem(key, mood);
	else localStorage.removeItem(key);
}

// Streak - per-user
function streakKeys(user?: unknown): { countKey: string; dateKey: string } {
	const userId = (user as any)?.id ?? (user as any)?.username ?? null;
	if (userId) return { countKey: `${STREAK_KEY}-${userId}`, dateKey: `${STREAK_DATE_KEY}-${userId}` };
	return { countKey: STREAK_KEY, dateKey: STREAK_DATE_KEY };
}

export function getStreak(user?: unknown): { count: number; lastDate: string | null } {
	if (!browser) return { count: 0, lastDate: null };
	const { countKey, dateKey } = streakKeys(user);
	const count = parseInt(localStorage.getItem(countKey) || '0', 10) || 0;
	const lastDate = localStorage.getItem(dateKey);
	return { count, lastDate };
}

export function bumpStreakIfNeeded(user?: unknown): number {
	if (!browser) return 0;
	const today = new Date().toISOString().slice(0, 10);
	const { count, lastDate } = getStreak(user);
	if (lastDate === today) return count;
	const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
	let next = count;
	if (lastDate === yesterday) next = count + 1;
	else if (lastDate !== today) next = lastDate ? 1 : 1;
	if (lastDate && lastDate !== yesterday && lastDate !== today) next = 1;
	if (!lastDate) next = 1;
	const { countKey, dateKey } = streakKeys(user);
	localStorage.setItem(countKey, String(next));
	localStorage.setItem(dateKey, today);
	return next;
}

// Taglines
export const TAGLINES = [
	'Certified binge-watcher',
	'Here for the plot',
	'Night owl mode: ON',
	'Professional procrastinator',
	'Will watch for snacks',
	'Plot-twist enthusiast'
] as const;

export function getRandomTagline(): string {
	return TAGLINES[Math.floor(Math.random() * TAGLINES.length)];
}

// Fun facts for logo easter egg
export const FUN_FACTS = [
	'Fun fact: The first movie ever made was 2 seconds long. You just wasted more time reading this.',
	'Joke: Why did the scarecrow get promoted? He was outstanding in his field.',
	'Fact: Octopuses have three hearts. Two pump blood, one pumps drama.',
	'Joke: I told my computer a joke. It didn’t get it. Its cache is too cold.',
	'Fact: You blink about 28,800 times a day. This fact just made you aware of it.'
] as const;

export function getRandomFunFact(): string {
	return FUN_FACTS[Math.floor(Math.random() * FUN_FACTS.length)];
}

// Time since joined helper
export function formatTimeSince(joinedAt: number | string | null): string {
	if (!joinedAt) return 'Just joined';
	const ts = typeof joinedAt === 'string' ? Date.parse(joinedAt) : joinedAt;
	if (!ts || Number.isNaN(ts)) return 'Just joined';
	let diff = Date.now() - ts;
	if (diff < 0) diff = 0;
	const days = Math.floor(diff / 86400000);
	diff %= 86400000;
	const hours = Math.floor(diff / 3600000);
	diff %= 3600000;
	const mins = Math.floor(diff / 60000);
	return `Member for ${days}d ${hours}h ${mins}m`;
}
