export const PRIVATE_PAGE_PREFIXES = [
	'/login',
	'/signup',
	'/logout',
	'/profile',
	'/history',
	'/watchlist'
];

// HTML pages render per-user state (account, watchlist, session) and can be reached by
// authenticated requests. Vercel's edge cache does not reliably honor Vary: Cookie, so a
// cached anonymous render can be served to logged-in users. Never edge-cache HTML pages.
export const PUBLIC_HTML_CACHE_CONTROL = 'private, no-store';

export function isPublicPagePath(path: string): boolean {
	return (
		!path.startsWith('/api/') &&
		!PRIVATE_PAGE_PREFIXES.some((p) => path === p || path.startsWith(p + '/'))
	);
}

export function htmlCacheControl(_user: unknown): string {
	return PUBLIC_HTML_CACHE_CONTROL;
}
