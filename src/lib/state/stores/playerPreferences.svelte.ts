import { browser } from '$app/environment';
import { isMobileDevice } from '$lib/utils/device';

const VOLUME_KEY = 'streamium-player-volume';
const MUTED_KEY = 'streamium-player-muted';
const SERVER_PREF_KEY = 'streamium-server-pref'; // suffixed with -mobile / -desktop
const DEFAULT_VOLUME = 100;

class PlayerPreferences {
	volume = $state(DEFAULT_VOLUME);
	muted = $state(false);
	serverPref = $state<string | null>(null);
	private initialized = false;

	private serverPrefKey(): string {
		// Mobile and desktop preferences live under separate keys so a mobile
		// default can never overwrite a desktop choice (and vice versa).
		return `${SERVER_PREF_KEY}-${isMobileDevice() ? 'mobile' : 'desktop'}`;
	}

	init() {
		if (this.initialized || !browser) return;
		this.initialized = true;
		try {
			const rawVolume = localStorage.getItem(VOLUME_KEY);
			if (rawVolume !== null) {
				const volume = Number(rawVolume);
				if (!Number.isNaN(volume) && volume >= 0 && volume <= 100) {
					this.volume = volume;
				}
			}
			const rawMuted = localStorage.getItem(MUTED_KEY);
			if (rawMuted !== null) this.muted = rawMuted === '1';
			this.serverPref = localStorage.getItem(this.serverPrefKey());
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

	// Persist the chosen streaming server, scoped to the current device type
	// so mobile and desktop selections stay independent.
	setServerPref(id: string) {
		this.serverPref = id;
		if (browser) {
			try {
				localStorage.setItem(this.serverPrefKey(), id);
			} catch {}
		}
	}
}

export const playerPreferences = new PlayerPreferences();
