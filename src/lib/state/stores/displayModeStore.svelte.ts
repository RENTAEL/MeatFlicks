const STORAGE_KEY = 'streamium-display-mode';

export type DisplayMode = 'desktop' | 'vr';

export function isWebXRAvailable(): boolean {
	if (typeof window === 'undefined' || typeof navigator === 'undefined') return false;
	const nav = navigator as Navigator & {
		xr?: { isSessionSupported?: (mode: string) => Promise<boolean> };
	};
	return !!nav.xr && typeof nav.xr.isSessionSupported === 'function';
}

class DisplayModeStore {
	#mode = $state<DisplayMode>('desktop');

	constructor() {
		if (typeof window === 'undefined') return;
		try {
			this.#mode = window.localStorage.getItem(STORAGE_KEY) === 'vr' ? 'vr' : 'desktop';
		} catch {}
		window.addEventListener('storage', (event) => {
			if (event.key === STORAGE_KEY) {
				this.#mode = event.newValue === 'vr' ? 'vr' : 'desktop';
			}
		});
	}

	get mode(): DisplayMode {
		return this.#mode;
	}

	get isVr(): boolean {
		return this.#mode === 'vr';
	}

	setMode(mode: DisplayMode) {
		this.#mode = mode;
		if (typeof window !== 'undefined') {
			try {
				window.localStorage.setItem(STORAGE_KEY, mode);
			} catch {}
		}
	}
}

export const displayMode = new DisplayModeStore();