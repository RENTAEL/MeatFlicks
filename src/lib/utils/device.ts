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

// Plain user-agent mobile detection (no libraries).
// Covers Android, iPhone, iPod, iPad (incl. iPadOS 13+ which reports as Mac + Mobile).
export function isMobileDevice(): boolean {
	if (typeof navigator === 'undefined' || !navigator.userAgent) return false;
	const ua = navigator.userAgent;
	return (
		/Android/i.test(ua) ||
		/iPhone|iPod/i.test(ua) ||
		/iPad/i.test(ua) ||
		(/Macintosh/i.test(ua) && /Mobile/i.test(ua))
	);
}
