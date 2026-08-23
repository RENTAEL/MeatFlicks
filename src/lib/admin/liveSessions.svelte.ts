/**
 * Shared live connection to the admin presence stream. One EventSource for
 * the whole admin UI — the session list, jumpscare/prank targeting and
 * broadcast targeting all read from this store instead of opening their own.
 */

export type LiveSessionUser = {
	userId: string;
	username: string;
	joinedAt: number;
	lastSeen: number;
	path: string | null;
	title: string | null;
	playing: boolean | null;
	roomId: string | null;
	roomTitle: string | null;
	roomHost: boolean;
	roomMemberSince: number | null;
};

type LiveState = {
	users: LiveSessionUser[];
	counts: { users: number; sessions: number };
	connected: boolean;
	lastAt: number;
};

const state = $state<LiveState>({
	users: [],
	counts: { users: 0, sessions: 0 },
	connected: false,
	lastAt: 0
});

let es: EventSource | null = null;
let refCount = 0;

export const liveSessions = {
	get users() {
		return state.users;
	},
	get counts() {
		return state.counts;
	},
	get connected() {
		return state.connected;
	},
	get lastAt() {
		return state.lastAt;
	}
};

export function connectLiveSessions(): () => void {
	refCount++;
	if (!es) {
		es = new EventSource('/api/admin/presence/stream');
		es.addEventListener('presence', (event) => {
			const data = JSON.parse((event as MessageEvent).data) as {
				users: LiveSessionUser[];
				counts: { users: number; sessions: number };
				at: number;
			};
			state.users = data.users;
			state.counts = data.counts;
			state.lastAt = data.at;
		});
		es.onopen = () => (state.connected = true);
		es.onerror = () => (state.connected = false);
	}
	return () => {
		refCount--;
		if (refCount <= 0 && es) {
			es.close();
			es = null;
			state.connected = false;
			refCount = 0;
		}
	};
}

export function isGuestSession(userId: string): boolean {
	return userId.startsWith('guest:');
}

/** Short human-readable session label: "guest abcd1234" or truncated user id. */
export function sessionLabel(userId: string): string {
	if (isGuestSession(userId)) return userId.slice(6, 14);
	return userId.length > 10 ? `${userId.slice(0, 8)}…` : userId;
}
