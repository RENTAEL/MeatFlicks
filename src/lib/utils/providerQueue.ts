const MIN_DELAY = 300;

type QueueTask = {
	id: string;
	fn: () => Promise<void>;
};

class ProviderQueue {
	private queue: QueueTask[] = [];
	private running = false;
	private inFlight = new Set<string>();

	enqueue(id: string, fn: () => Promise<void>): void {
		if (this.inFlight.has(id)) return;
		this.queue.push({ id, fn });
		if (!this.running) this.process();
	}

	private async process(): Promise<void> {
		this.running = true;
		while (this.queue.length > 0) {
			const task = this.queue.shift()!;
			this.inFlight.add(task.id);
			try {
				await task.fn();
			} catch {
				// task failed silently
			}
			this.inFlight.delete(task.id);
			if (this.queue.length > 0) {
				await new Promise((r) => setTimeout(r, MIN_DELAY));
			}
		}
		this.running = false;
	}
}

export const providerQueue = new ProviderQueue();
