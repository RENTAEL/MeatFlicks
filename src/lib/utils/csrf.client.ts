import { browser } from '$app/environment';

let tokenPromise: Promise<string | null> | null = null;

export function getCsrfTokenClient(): Promise<string | null> {
	if (!browser) return Promise.resolve(null);
	if (!tokenPromise) {
		tokenPromise = fetch('/api/csrf', { credentials: 'include' })
			.then((r) => (r.ok ? r.json() : null))
			.then((d) => (d && typeof d.token === 'string' ? d.token : null))
			.catch(() => null);
	}
	return tokenPromise;
}