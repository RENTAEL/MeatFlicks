const listeners = new Map<string, Set<() => void>>();

export function subscribeRoom(roomId: string, cb: () => void): () => void {
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

export function publishRoom(roomId: string) {
	const set = listeners.get(roomId);
	if (!set) return;
	for (const cb of [...set]) {
		try {
			cb();
		} catch {
			// subscriber errors are non-fatal
		}
	}
}
