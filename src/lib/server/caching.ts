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

// Cache-Control for any response whose body varies per authenticated user.
export const PRIVATE_API_CACHE_CONTROL = 'private, no-store';

export function privateCacheControl(): string {
	return PRIVATE_API_CACHE_CONTROL;
}

// These endpoints are genuinely public and non-personalised. They set their own
// `public, ...` Cache-Control on purpose and must never be forced private — they are
// checked BEFORE the private list below so that a broader private prefix
// (e.g. '/api/quotes') cannot accidentally swallow them.
export const PUBLIC_API_PATHS = ['/api/announcement', '/api/feature-flags', '/api/quotes/daily'];

// Per-user API paths, matched on exact path or path-segment prefix.
//
// Vercel stamps `public, max-age=0, must-revalidate` on any function response that does
// not set Cache-Control itself. `public` authorises storage in the shared edge cache and
// nothing keys those entries to a user, so a hit could serve one account's data to
// another. Deliberately NOT prefixes here: '/api/search' (public search endpoints live
// alongside /api/search/history) and '/api/tv' (/api/tv/[id] is public catalogue data —
// the two per-user TV routes are matched by pattern instead).
export const PRIVATE_API_PATH_PREFIXES = [
	'/api/watchlist',
	'/api/history',
	'/api/search/history',
	'/api/commands',
	'/api/recommendations',
	'/api/playback/progress',
	'/api/quotes'
];

const PRIVATE_API_PATH_PATTERNS = [
	/^\/api\/tv\/[^/]+\/status$/,
	/^\/api\/tv\/[^/]+\/episode\/[^/]+\/progress$/
];

function matchesPath(path: string, base: string): boolean {
	return path === base || path.startsWith(base + '/');
}

export function isPrivateApiPath(path: string): boolean {
	if (PUBLIC_API_PATHS.some((p) => matchesPath(path, p))) {
		return false;
	}
	if (PRIVATE_API_PATH_PREFIXES.some((p) => matchesPath(path, p))) {
		return true;
	}
	return PRIVATE_API_PATH_PATTERNS.some((re) => re.test(path));
}
