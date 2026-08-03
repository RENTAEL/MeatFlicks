import { browser } from '$app/environment';

const VOLUME_KEY = 'streamium-player-volume';
const MUTED_KEY = 'streamium-player-muted';
const DEFAULT_VOLUME = 100;

class PlayerPreferences {
	volume = $state(DEFAULT_VOLUME);
	muted = $state(false);
	private initialized = false;

	init() {
		if (this.initialized || !browser) return;
		this.initialized = true;
		try {
			const rawVolume = Number(localStorage.getItem(VOLUME_KEY));
			if (!Number.isNaN(rawVolume) && rawVolume >= 0 && rawVolume <= 100) {
				this.volume = rawVolume;
			}
			const rawMuted = localStorage.getItem(MUTED_KEY);
			if (rawMuted !== null) this.muted = rawMuted === '1';
		} catch {}
	}

	setVolume(value: number) {
		this.volume = Math.max(0, Math.min(100, Math.round(value)));
		if (this.volume === 0) {
			this.muted = true;
			if (browser) {
				try {
					localStorage.setItem(MUTED_KEY, '1');
				} catch {}
			}
		} else if (this.muted) {
			this.muted = false;
			if (browser) {
				try {
					localStorage.setItem(MUTED_KEY, '0');
				} catch {}
			}
		}
		if (browser) {
			try {
				localStorage.setItem(VOLUME_KEY, String(this.volume));
			} catch {}
		}
	}

	toggleMute() {
		this.muted = !this.muted;
		if (browser) {
			try {
				localStorage.setItem(MUTED_KEY, this.muted ? '1' : '0');
			} catch {}
		}
	}
}

export const playerPreferences = new PlayerPreferences();
