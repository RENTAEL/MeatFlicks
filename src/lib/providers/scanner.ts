import { SORTED_PROVIDERS, type Provider, type ProviderParams } from './index';
import { browser } from '$app/environment';

export type ProbeResult = {
	provider: Provider;
	url: string;
	status: 'checking' | 'up' | 'down';
};

const PROBE_TIMEOUT = 8000;

function probeProvider(provider: Provider, params: ProviderParams): Promise<ProbeResult> {
	const url = provider.buildUrl(params);

	return new Promise((resolve) => {
		if (!browser) {
			resolve({ provider, url, status: 'down' });
			return;
		}

		const iframe = document.createElement('iframe');
		iframe.src = url;
		iframe.style.cssText =
			'position:fixed;top:-9999px;left:-9999px;width:1px;height:1px;opacity:0;pointer-events:none;';
		iframe.referrerPolicy = 'no-referrer';

		let done = false;

		function finish(status: 'up' | 'down') {
			if (done) return;
			done = true;
			clearTimeout(timer);
			iframe.onload = null;
			iframe.onerror = null;
			try { iframe.remove(); } catch {}
			resolve({ provider, url, status });
		}

		const timer = setTimeout(() => finish('down'), PROBE_TIMEOUT);

		iframe.onload = () => {
			setTimeout(() => finish('up'), 1000);
		};

		iframe.onerror = () => finish('down');

		document.body.appendChild(iframe);
	});
}

export type ScanResult = {
	results: ProbeResult[];
	firstUp: ProbeResult | null;
};

export async function scanAllProviders(
	params: ProviderParams,
	onUpdate?: (results: ProbeResult[]) => void
): Promise<ScanResult> {
	const providers = SORTED_PROVIDERS;
	const total = providers.length;
	const results: ProbeResult[] = [];

	for (let i = 0; i < total; i++) {
		results.push({
			provider: providers[i],
			url: providers[i].buildUrl(params),
			status: 'checking'
		});
	}
	onUpdate?.([...results]);

	let firstUp: ProbeResult | null = null;

	for (let i = 0; i < total; i += 3) {
		const batch = providers.slice(i, i + 3);
		const batchResults = await Promise.all(
			batch.map(async (provider, bi) => {
				await new Promise((r) => setTimeout(r, bi * 300));
				const result = await probeProvider(provider, params);
				const idx = i + bi;
				results[idx] = result;
				if (result.status === 'up' && !firstUp) firstUp = result;
				onUpdate?.([...results]);
				return result;
			})
		);

		if (i + 3 < total) {
			await new Promise((r) => setTimeout(r, 500));
		}
	}

	results.sort((a, b) => {
		const aScore = a.status === 'up' ? 0 : a.status === 'checking' ? 1 : 2;
		const bScore = b.status === 'up' ? 0 : b.status === 'checking' ? 1 : 2;
		if (aScore !== bScore) return aScore - bScore;
		return a.provider.priority - b.provider.priority;
	});

	return { results, firstUp };
}
