/**
 * Playback-state reporting for presence. Players call reportPlayback() on
 * play/pause transitions; the presence heartbeat attaches the latest value.
 * Mirrored to sessionStorage so the value survives page navigations within
 * the tab. Fully additive — nothing else reads this unless opted in.
 */
const KEY = 'streamium-playback-state';

let current: boolean | null = null;

if (typeof sessionStorage !== 'undefined') {
	try {
		const raw = sessionStorage.getItem(KEY);
		if (raw === '1' || raw === '0') current = raw === '1';
	} catch {}
}

export function reportPlayback(playing: boolean): void {
	current = playing;
	try {
		sessionStorage.setItem(KEY, playing ? '1' : '0');
	} catch {}
	// Ambient layers (particles, blurs) pause while video plays so low-end
	// phones never starve the decoder.
	if (typeof window !== 'undefined') {
		window.dispatchEvent(new CustomEvent('streamium-playback', { detail: { playing } }));
	}
}

export function getReportedPlayback(): boolean | null {
	return current;
}
