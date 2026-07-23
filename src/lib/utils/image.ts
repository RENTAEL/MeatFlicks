/**
 * Resolves an image path to a proxy URL or returns the absolute URL as is.
 * @param path The image path (relative starting with / or absolute)
 * @param width Optional width (e.g., 'w500', 'original')
 * @returns The resolved image URL
 */
export function getImageUrl(path: string | null | undefined, width: string = 'original'): string {
	if (!path) return '';
	if (path.startsWith('http')) return path;

	const normalizedPath = path.startsWith('/') ? path : `/${path}`;
	return `/api/images${normalizedPath}?w=${width}`;
}

/**
 * Returns a srcset string for responsive images.
 */
export function getSrcSet(path: string | null | undefined): string | undefined {
	if (!path || path.startsWith('http')) return undefined;
	const normalizedPath = path.startsWith('/') ? path : `/${path}`;
	const widths = ['w92', 'w185', 'w342', 'w500', 'w780'];
	return widths.map((w) => `/api/images${normalizedPath}?w=${w} ${w.replace('w', '')}w`).join(', ');
}

/**
 * Returns the best image size for a given context.
 * 'poster' -> w342, 'hero' -> w780 or w1280, 'thumbnail' -> w185, 'micro' -> w92
 */
export function getOptimalImageSize(context: 'poster' | 'hero' | 'thumbnail' | 'micro' | 'card'): string {
	if (typeof window === 'undefined') {
		if (context === 'hero') return 'w1280';
		if (context === 'card' || context === 'poster') return 'w342';
		return 'w185';
	}
	const width = window.innerWidth;
	if (width < 640) {
		if (context === 'hero') return 'w780';
		if (context === 'card' || context === 'poster') return 'w185';
		if (context === 'thumbnail') return 'w92';
		return 'w185';
	}
	if (width < 1024) {
		if (context === 'hero') return 'w780';
		if (context === 'card' || context === 'poster') return 'w342';
		return 'w185';
	}
	if (context === 'hero') return 'w1280';
	if (context === 'card' || context === 'poster') return 'w342';
	return 'w342';
}
