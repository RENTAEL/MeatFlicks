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

// Mood
export const MOODS = ['😎', '🥱', '😭', '🤯'] as const;
export type Mood = (typeof MOODS)[number];

export function getMood(): Mood | null {
	if (!browser) return null;
	const v = localStorage.getItem(MOOD_KEY) as Mood | null;
	return v && (MOODS as readonly string[]).includes(v) ? v : null;
}

export function setMood(mood: Mood | null) {
	if (!browser) return;
	if (mood) localStorage.setItem(MOOD_KEY, mood);
	else localStorage.removeItem(MOOD_KEY);
}

// Streak
export function getStreak(): { count: number; lastDate: string | null } {
	if (!browser) return { count: 0, lastDate: null };
	const count = parseInt(localStorage.getItem(STREAK_KEY) || '0', 10) || 0;
	const lastDate = localStorage.getItem(STREAK_DATE_KEY);
	return { count, lastDate };
}

export function bumpStreakIfNeeded(): number {
	if (!browser) return 0;
	const today = new Date().toISOString().slice(0, 10);
	const { count, lastDate } = getStreak();
	if (lastDate === today) return count;
	const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
	let next = count;
	if (lastDate === yesterday) next = count + 1;
	else if (lastDate !== today) next = lastDate ? 1 : 1; // first or broken streak -> 1
	// Actually for broken streak, reset to 1. For first ever, 1.
	if (lastDate && lastDate !== yesterday && lastDate !== today) next = 1;
	if (!lastDate) next = 1;
	localStorage.setItem(STREAK_KEY, String(next));
	localStorage.setItem(STREAK_DATE_KEY, today);
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
