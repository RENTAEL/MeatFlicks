import { browser } from '$app/environment';

const STORAGE_KEY = 'streamium-skip-settings';

type SkipSettings = {
	autoSkipIntro: boolean;
	autoSkipOutro: boolean;
	autoSkipRecap: boolean;
	offsetSeconds: number;
};

function loadSettings(): SkipSettings {
	if (!browser) return { autoSkipIntro: true, autoSkipOutro: false, autoSkipRecap: false, offsetSeconds: 0 };
	try {
		const stored = localStorage.getItem(STORAGE_KEY);
		if (stored) return { ...defaultSettings, ...JSON.parse(stored) };
	} catch {}
	return { ...defaultSettings };
}

function saveSettings(s: SkipSettings) {
	if (!browser) return;
	try {
		localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
	} catch {}
}

const defaultSettings: SkipSettings = {
	autoSkipIntro: true,
	autoSkipOutro: false,
	autoSkipRecap: false,
	offsetSeconds: 0
};

function createSkipSettingsStore() {
	let settings = $state<SkipSettings>(loadSettings());

	function set<K extends keyof SkipSettings>(key: K, value: SkipSettings[K]) {
		settings = { ...settings, [key]: value };
		saveSettings(settings);
	}

	function reset() {
		settings = { ...defaultSettings };
		saveSettings(settings);
	}

	return {
		get settings() { return settings; },
		set,
		reset
	};
}

export const skipSettings = createSkipSettingsStore();
