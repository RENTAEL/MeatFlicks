export const PRIVATE_PAGE_PREFIXES = [
	'/login',
	'/signup',
	'/logout',
	'/profile',
	'/history',
	'/watchlist'
];

export const PUBLIC_HTML_CACHE_CONTROL = 'public, s-maxage=300, stale-while-revalidate=300';

export function isPublicPagePath(path: string): boolean {
	return (
		!path.startsWith('/api/') &&
		!PRIVATE_PAGE_PREFIXES.some((p) => path === p || path.startsWith(p + '/'))
	);
}

export function htmlCacheControl(user: unknown): string {
	return user ? 'private, no-store' : PUBLIC_HTML_CACHE_CONTROL;
}
