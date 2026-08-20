const listeners = new Map<string, Set<(payload?: RoomEvent) => void>>();
const globalListeners = new Set<(roomId: string, payload?: RoomEvent) => void>();

export type RoomEvent =
	| { type: 'kick'; userId: string; by: string; at: number }
	| { type: 'state' };

export function subscribeRoom(roomId: string, cb: (payload?: RoomEvent) => void): () => void {
	let set = listeners.get(roomId);
	if (!set) {
		set = new Set();
		listeners.set(roomId, set);
	}
	set.add(cb);
	return () => {
		set.delete(cb);
		if (set.size === 0) listeners.delete(roomId);
	};
}

/**
 * Subscribe to every room's events (used by the admin active-sessions
 * stream). The callback receives the roomId and the optional event payload.
 * Called after every publishRoom, including rooms created after subscribe.
 */
export function subscribeAllRooms(cb: (roomId: string, payload?: RoomEvent) => void): () => void {
	globalListeners.add(cb);
	return () => {
		globalListeners.delete(cb);
	};
}

export function publishRoom(roomId: string, payload?: RoomEvent) {
	const set = listeners.get(roomId);
	if (set) {
		for (const cb of [...set]) {
			try {
				cb(payload);
			} catch {
				// subscriber errors are non-fatal
			}
		}
	}
	for (const cb of [...globalListeners]) {
		try {
			cb(roomId, payload);
		} catch {
			// subscriber errors are non-fatal
		}
	}
}
