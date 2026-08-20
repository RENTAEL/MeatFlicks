export function isDesktopDevice(): boolean {
	if (typeof navigator === 'undefined' || typeof window === 'undefined') return true;
	const ua = navigator.userAgent;
	if (/Mobi|Android|iPhone|iPad|iPod|IEMobile|Opera Mini|BlackBerry|Windows Phone/i.test(ua)) {
		return false;
	}
	if (typeof window.matchMedia === 'function') {
		const coarseTouch = window.matchMedia('(pointer: coarse)').matches;
		const smallScreen = window.innerWidth < 768;
		if (coarseTouch && smallScreen) return false;
	}
	return true;
}
