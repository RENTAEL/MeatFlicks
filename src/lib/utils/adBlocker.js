const debug = import.meta.env.DEV ? console.log : () => {};

const AD_URL_PATTERNS = [
	/\bpop\b/i,
	/popup/i,
	/popunder/i,
	/pop_/i,
	/adserv/i,
	/advert/i,
	/doubleclick/i,
	/googlesyndication/i,
	/outbrain\.com/i,
	/taboola\.com/i,
	/criteo/i,
	/exoclick/i,
	/popads/i,
	/popcash/i,
	/adsterra/i,
	/propeller/i,
	/clickadu/i
];

const AD_CLASS_PATTERNS = [
	'popup',
	'popunder',
	'pop-under',
	'pop_up',
	'popad',
	'advert',
	'sponsor',
	'monetiz',
	'propeller',
	'popads',
	'popcash',
	'adsterra',
	'ad-maven',
	'exoclick',
	'traffic',
	'clickadu',
	'galaksion',
	'adult',
	'dating',
	'casino',
	'doubleclick',
	'googlesyndication',
	'amazon-adsystem',
	'outbrain',
	'taboola',
	'criteo',
	'revcontent',
	'overlay-ad',
	'ad-overlay',
	'ad-container',
	'ad-wrapper'
];

/**
 * @param {Element} el
 */
function isAppUi(el) {
	return !!el.closest?.('[data-app-ui]');
}

const originalOpen = window.open;
window.open = function (url, target, features) {
	if (!target || target === '_blank' || target === '_new') {
		debug('[AdBlocker] Blocked popup:', url);
		return null;
	}
	return originalOpen.call(window, url, target, features);
};

const observer = new MutationObserver((mutations) => {
	for (const mutation of mutations) {
		for (const node of mutation.addedNodes) {
			if (node.nodeType !== 1) continue;
			const el = /** @type {HTMLElement} */ (node);
			if (isAppUi(el)) continue;
			if (el.tagName === 'IFRAME') {
				const src = el.getAttribute('src') || '';
				const name = el.getAttribute('name') || '';
				const combined = `${src} ${name} ${el.className || ''} ${el.id || ''}`.toLowerCase();
				if (AD_URL_PATTERNS.some((p) => p.test(combined))) {
					el.remove();
					debug('[AdBlocker] Removed ad iframe:', src);
					continue;
				}
			}
			if (el.tagName === 'DIV' || el.tagName === 'A' || el.tagName === 'SECTION') {
				const text =
					`${el.className || ''} ${el.id || ''} ${el.getAttribute('aria-label') || ''}`.toLowerCase();
				if (AD_CLASS_PATTERNS.some((p) => text.includes(p))) {
					const style = window.getComputedStyle(el);
					const zIndex = parseInt(style.zIndex);
					if (zIndex > 1000 || style.position === 'fixed' || style.position === 'absolute') {
						el.remove();
						debug('[AdBlocker] Removed ad overlay:', text.substring(0, 50));
					}
				}
			}
		}
	}
});

const originalFetch = window.fetch;
window.fetch = function (input, init) {
	const url = typeof input === 'string' ? input : /** @type {Request} */ (input).url || '';
	if (AD_URL_PATTERNS.some((p) => p.test(url))) {
		debug('[AdBlocker] Blocked fetch:', url);
		return Promise.reject(new Error('Blocked by ad blocker'));
	}
	return originalFetch.call(window, input, init);
};

function cleanExisting() {
	const overlays = document.querySelectorAll('[style*="z-index"]');
	overlays.forEach((el) => {
		if (isAppUi(el)) return;
		const style = window.getComputedStyle(el);
		const zIndex = parseInt(style.zIndex);
		if (zIndex > 5000 && (style.position === 'fixed' || style.position === 'absolute')) {
			const text = (el.className + ' ' + el.id).toLowerCase();
			if (AD_CLASS_PATTERNS.some((p) => text.includes(p))) {
				el.remove();
			}
		}
	});
}

export function initAdBlocker() {
	if (typeof window === 'undefined') return;
	observer.observe(document.body, { childList: true, subtree: true });
	if (document.readyState === 'loading') {
		document.addEventListener('DOMContentLoaded', cleanExisting);
	} else {
		cleanExisting();
	}
	setInterval(cleanExisting, 5000);
	debug('[AdBlocker] Active');
}
