export function getScrollY(): number {
	return (
		window.scrollY ||
		window.pageYOffset ||
		document.documentElement.scrollTop ||
		document.body.scrollTop ||
		0
	);
}

export function addScrollListener(handler: () => void): () => void {
	document.addEventListener('scroll', handler, { passive: true, capture: true });
	return () => document.removeEventListener('scroll', handler, true);
}
