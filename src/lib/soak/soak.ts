import { writable } from 'svelte/store';

export interface SoakSnapshot {
	role: 'host' | 'member' | null;
	seq: number;
	hostPos: number;
	memberPos: number;
	drift: number;
	status: 'synced' | 'drifted' | 'syncing' | 'host' | 'unknown';
	lastAction: string;
	provider: string | null;
	iframeLoaded: boolean;
}

export interface SoakLogEntry {
	at: number;
	kind: string;
	msg: string;
}

const initial: SoakSnapshot = {
	role: null,
	seq: 0,
	hostPos: 0,
	memberPos: 0,
	drift: 0,
	status: 'unknown',
	lastAction: '',
	provider: null,
	iframeLoaded: false
};

let enabled = false;
try {
	enabled =
		typeof window !== 'undefined' &&
		new URLSearchParams(window.location.search).get('soak') === '1';
} catch {
	enabled = false;
}

export function isSoak(): boolean {
	return enabled;
}

export const soakState = writable<SoakSnapshot>(initial);
export const soakEntries = writable<SoakLogEntry[]>([]);

const MAX_ENTRIES = 80;

export function soakEvent(kind: string, msg: string): void {
	if (!enabled) return;
	const entry: SoakLogEntry = { at: Date.now(), kind, msg };
	soakEntries.update((list) =>
		list.length >= MAX_ENTRIES ? [...list.slice(1), entry] : [...list, entry]
	);
	console.log(`[soak] ${new Date(entry.at).toISOString().slice(11, 23)} [${kind}] ${msg}`);
}

export function soakUpdate(patch: Partial<SoakSnapshot>): void {
	if (!enabled) return;
	soakState.update((s) => ({ ...s, ...patch }));
}

export function soakClear(): void {
	if (!enabled) return;
	soakEntries.set([]);
}
