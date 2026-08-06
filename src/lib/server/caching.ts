export const PRIVATE_PAGE_PREFIXES = [
	'/login',
	'/signup',
	'/logout',
	'/profile',
	'/history',
	'/watchlist'
];

export function isPublicPagePath(path: string): boolean {
	return (
		!path.startsWith('/api/') &&
		!PRIVATE_PAGE_PREFIXES.some((p) => path === p || path.startsWith(p + '/'))
	);
}
