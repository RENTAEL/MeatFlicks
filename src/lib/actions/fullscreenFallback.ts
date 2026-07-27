export function fullscreenFallback(node: HTMLElement) {
	let active = false;
	let isCssFs = false;
	const origStyles: Record<string, string> = {};

	function saveStyles() {
		const keys = ['position', 'top', 'left', 'width', 'height', 'zIndex', 'background', 'margin', 'maxWidth', 'maxHeight', 'borderRadius'];
		for (const key of keys) {
			origStyles[key] = node.style[key as any] as string || '';
		}
	}

	function restoreStyles() {
		for (const [key, val] of Object.entries(origStyles)) {
			(node.style as any)[key] = val;
		}
	}

	function applyCssFs() {
		isCssFs = true;
		const h = (window as any).visualViewport?.height ?? window.innerHeight;
		const w = (window as any).visualViewport?.width ?? window.innerWidth;
		Object.assign(node.style, {
			position: 'fixed',
			top: '0',
			left: '0',
			right: '0',
			bottom: '0',
			width: `${w}px`,
			height: `${h}px`,
			maxWidth: 'none',
			maxHeight: 'none',
			zIndex: '99999',
			background: '#000',
			margin: '0',
			borderRadius: '0',
			overflow: 'hidden',
		});
		node.setAttribute('data-css-fullscreen', 'true');
		const media = node.querySelector('video, iframe, [data-player]') as HTMLElement;
		if (media) {
			media.style.width = '100%';
			media.style.height = '100%';
			media.style.borderRadius = '0';
		}
		const inner = node.firstElementChild as HTMLElement;
		if (inner) {
			inner.style.width = '100%';
			inner.style.height = '100%';
			inner.style.borderRadius = '0';
		}
		document.body.style.overflow = 'hidden';
	}

	function removeCssFs() {
		isCssFs = false;
		restoreStyles();
		node.removeAttribute('data-css-fullscreen');
		const media = node.querySelector('video, iframe, [data-player]') as HTMLElement;
		if (media) {
			media.style.removeProperty('width');
			media.style.removeProperty('height');
			media.style.removeProperty('borderRadius');
		}
		const inner = node.firstElementChild as HTMLElement;
		if (inner) {
			inner.style.removeProperty('width');
			inner.style.removeProperty('height');
			inner.style.removeProperty('borderRadius');
		}
		document.body.style.overflow = '';
	}

	function handleResize() {
		if (!active || !isCssFs) return;
		requestAnimationFrame(() => {
			const h = (window as any).visualViewport?.height ?? window.innerHeight;
			const w = (window as any).visualViewport?.width ?? window.innerWidth;
			node.style.width = `${w}px`;
			node.style.height = `${h}px`;
		});
	}

	function enterFullscreen(): Promise<void> {
		if (active) return Promise.resolve();
		active = true;
		saveStyles();

		const el = node.querySelector('iframe') || node;
		const method =
			(el as any).requestFullscreen?.bind(el) ||
			(el as any).webkitRequestFullscreen?.bind(el) ||
			(el as any).webkitEnterFullscreen?.bind(el);

		if (method) {
			try {
				return method().catch(() => { applyCssFs(); return Promise.resolve(); });
			} catch {
				applyCssFs();
				return Promise.resolve();
			}
		}

		applyCssFs();
		return Promise.resolve();
	}

	function exitFullscreen(): Promise<void> {
		if (!active) return Promise.resolve();
		active = false;

		if (isCssFs) {
			removeCssFs();
			return Promise.resolve();
		}

		const doc = document as any;
		const method = doc.exitFullscreen?.bind(doc) || doc.webkitExitFullscreen?.bind(doc) || doc.mozCancelFullScreen?.bind(doc);
		if (method) {
			try { return method().catch(() => removeCssFs()); }
			catch { removeCssFs(); return Promise.resolve(); }
		}

		return Promise.resolve();
	}

	function onKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape' && active) exitFullscreen();
	}

	function onFsChange() {
		const fsEl = document.fullscreenElement || (document as any).webkitFullscreenElement;
		if (!fsEl && active) {
			active = false;
			if (isCssFs) removeCssFs();
		}
	}

	node.addEventListener('keydown', onKeydown);
	document.addEventListener('fullscreenchange', onFsChange);
	document.addEventListener('webkitfullscreenchange', onFsChange);
	window.addEventListener('resize', handleResize);
	window.addEventListener('orientationchange', handleResize);
	if ('visualViewport' in window) {
		(window as any).visualViewport?.addEventListener('resize', handleResize);
	}

	return {
		destroy() {
			node.removeEventListener('keydown', onKeydown);
			document.removeEventListener('fullscreenchange', onFsChange);
			document.removeEventListener('webkitfullscreenchange', onFsChange);
			window.removeEventListener('resize', handleResize);
			window.removeEventListener('orientationchange', handleResize);
			if ('visualViewport' in window) {
				(window as any).visualViewport?.removeEventListener('resize', handleResize);
			}
			if (active) exitFullscreen();
		},
		enterFullscreen,
		exitFullscreen,
	};
}
