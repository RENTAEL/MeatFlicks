type WatchProvider = {
	logo_path: string | null;
	provider_id: number;
	provider_name: string;
	display_priority: number;
};

type ProviderResult = {
	flatrate: WatchProvider[];
	rent: WatchProvider[];
	buy: WatchProvider[];
};

type CacheEntry = {
	data: ProviderResult;
	fetchedAt: number;
};

class ProviderCache {
	private cache = new Map<string, CacheEntry>();
	private TTL = 1000 * 60 * 60;

	async get(movieId: number): Promise<ProviderResult | null> {
		const key = String(movieId);
		const entry = this.cache.get(key);
		if (entry && Date.now() - entry.fetchedAt < this.TTL) {
			return entry.data;
		}
		const data = await this.fetch(movieId);
		if (data) {
			this.cache.set(key, { data, fetchedAt: Date.now() });
		}
		return data;
	}

	set(movieId: number, data: ProviderResult): void {
		this.cache.set(String(movieId), { data, fetchedAt: Date.now() });
	}

	has(movieId: number): boolean {
		const entry = this.cache.get(String(movieId));
		if (!entry) return false;
		if (Date.now() - entry.fetchedAt >= this.TTL) {
			this.cache.delete(String(movieId));
			return false;
		}
		return true;
	}

	private async fetch(movieId: number): Promise<ProviderResult | null> {
		try {
			const res = await fetch(`/api/providers/${movieId}`);
			if (!res.ok) return null;
			return await res.json();
		} catch {
			return null;
		}
	}
}

export const providerCache = new ProviderCache();
