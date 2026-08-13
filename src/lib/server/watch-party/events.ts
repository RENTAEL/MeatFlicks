const listeners = new Map<string, Set<(payload?: RoomEvent) => void>>();

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

export function publishRoom(roomId: string, payload?: RoomEvent) {
	const set = listeners.get(roomId);
	if (!set) return;
	for (const cb of [...set]) {
		try {
			cb(payload);
		} catch {
			// subscriber errors are non-fatal
		}
	}
}
