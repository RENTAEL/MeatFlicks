export function getImageUrl(path: string | null | undefined, width: string = 'original'): string {
	if (!path) return '';
	if (path.startsWith('http')) return path;
	const normalizedPath = path.startsWith('/') ? path : `/${path}`;
	return `/api/images${normalizedPath}?w=${width}`;
}

export function getSrcSet(path: string | null | undefined): string | undefined {
	if (!path || path.startsWith('http')) return undefined;
	const normalizedPath = path.startsWith('/') ? path : `/${path}`;
	const widths = ['w92', 'w185', 'w342', 'w500', 'w780'];
	return widths.map((w) => `/api/images${normalizedPath}?w=${w} ${w.replace('w', '')}w`).join(', ');
}

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

export function getResponsivePosterUrl(path: string | null | undefined): { src: string; srcset: string | undefined; sizes: string } {
	const src = getImageUrl(path, 'w342');
	const srcset = getSrcSet(path);
	const sizes = '(max-width: 640px) 140px, (max-width: 1024px) 200px, 240px';
	return { src, srcset, sizes };
}
