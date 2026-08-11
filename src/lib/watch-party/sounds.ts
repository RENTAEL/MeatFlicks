import { browser } from '$app/environment';

let ctx: AudioContext | null = null;
let masterGain: GainNode | null = null;
let volume = 1;
let muted = false;

const VOLUME_KEY = 'wp-fx-volume';
const MUTE_KEY = 'wp-fx-mute';

function persistVolume() {
	if (!browser) return;
	try { localStorage.setItem(VOLUME_KEY, String(volume)); } catch {}
}

function persistMute() {
	if (!browser) return;
	try { localStorage.setItem(MUTE_KEY, muted ? '1' : '0'); } catch {}
}

function applyVolume() {
	if (masterGain) masterGain.gain.value = muted ? 0 : volume;
}

function getContext(): AudioContext | null {
	if (!browser) return null;
	try {
		if (!ctx) {
			const AC = window.AudioContext || (window as any).webkitAudioContext;
			if (!AC) return null;
			ctx = new AC();
			masterGain = ctx.createGain();
			masterGain.connect(ctx.destination);
			try {
				const v = Number(localStorage.getItem(VOLUME_KEY));
				if (v >= 0 && v <= 1) volume = v;
				muted = localStorage.getItem(MUTE_KEY) === '1';
			} catch {}
			applyVolume();
		}
		if (ctx.state === 'suspended') ctx.resume();
		return ctx;
	} catch {
		return null;
	}
}

export function getSoundVolume() {
	return volume;
}

export function getSoundMuted() {
	return muted;
}

export function setSoundVolume(v: number) {
	volume = Math.min(1, Math.max(0, v));
	applyVolume();
	persistVolume();
}

export function toggleSoundMute(): boolean {
	muted = !muted;
	applyVolume();
	persistMute();
	return muted;
}

function whiteNoiseBuffer(ac: AudioContext, seconds: number) {
	const buffer = ac.createBuffer(1, Math.floor(ac.sampleRate * seconds), ac.sampleRate);
	const data = buffer.getChannelData(0);
	for (let i = 0; i < data.length; i++) {
		data[i] = Math.random() * 2 - 1;
	}
	return buffer;
}

const effects: Record<
	string,
	(ac: AudioContext) => { stop: () => void }
> = {
	applause: (ac) => {
		const src = ac.createBufferSource();
		src.buffer = whiteNoiseBuffer(ac, 1.6);
		src.playbackRate.value = 0.55;
		const gain = ac.createGain();
		gain.gain.setValueAtTime(0.0001, ac.currentTime);
		gain.gain.exponentialRampToValueAtTime(0.45, ac.currentTime + 0.08);
		gain.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + 1.6);
		const filter = ac.createBiquadFilter();
		filter.type = 'bandpass';
		filter.frequency.value = 1600;
		src.connect(filter).connect(gain).connect(masterGain!);
		src.start();
		return { stop: () => src.stop() };
	},
	boo: (ac) => {
		const osc = ac.createOscillator();
		osc.type = 'sawtooth';
		const osc2 = ac.createOscillator();
		osc2.type = 'triangle';
		osc.frequency.setValueAtTime(150, ac.currentTime);
		osc.frequency.linearRampToValueAtTime(90, ac.currentTime + 1.2);
		osc2.frequency.setValueAtTime(151, ac.currentTime);
		osc2.frequency.linearRampToValueAtTime(91, ac.currentTime + 1.2);
		const gain = ac.createGain();
		gain.gain.setValueAtTime(0.0001, ac.currentTime);
		gain.gain.exponentialRampToValueAtTime(0.4, ac.currentTime + 0.15);
		gain.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + 1.4);
		osc.connect(gain);
		osc2.connect(gain);
		gain.connect(masterGain!);
		osc.start();
		osc2.start();
		const stop = () => { try { osc.stop(); osc2.stop(); } catch {} };
		return { stop };
	},
	jump: (ac) => {
		const osc = ac.createOscillator();
		osc.type = 'square';
		osc.frequency.setValueAtTime(880, ac.currentTime);
		osc.frequency.exponentialRampToValueAtTime(110, ac.currentTime + 0.55);
		const gain = ac.createGain();
		gain.gain.setValueAtTime(0.0001, ac.currentTime);
		gain.gain.exponentialRampToValueAtTime(0.4, ac.currentTime + 0.02);
		gain.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + 0.7);
		osc.connect(gain).connect(masterGain!);
		osc.start();
		return { stop: () => { try { osc.stop(); } catch {} } };
	},
	suspense: (ac) => {
		const osc = ac.createOscillator();
		osc.type = 'sine';
		const osc2 = ac.createOscillator();
		osc2.type = 'sine';
		osc.frequency.setValueAtTime(392, ac.currentTime);
		osc.frequency.linearRampToValueAtTime(155, ac.currentTime + 1.8);
		osc2.frequency.setValueAtTime(294, ac.currentTime);
		osc2.frequency.linearRampToValueAtTime(123, ac.currentTime + 1.8);
		const gain = ac.createGain();
		gain.gain.setValueAtTime(0.0001, ac.currentTime);
		gain.gain.exponentialRampToValueAtTime(0.25, ac.currentTime + 0.3);
		gain.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + 1.9);
		osc.connect(gain);
		osc2.connect(gain);
		gain.connect(masterGain!);
		osc.start();
		osc2.start();
		return { stop: () => { try { osc.stop(); osc2.stop(); } catch {} } };
	}
};

const activeByKind = new Map<string, { stop: () => void }>();

export function playSoundEffect(kind: string) {
	const ac = getContext();
	if (!ac) return;
	const builder = effects[kind];
	if (!builder) return;
	const prev = activeByKind.get(kind);
	if (prev) prev.stop();
	const active = builder(ac);
	activeByKind.set(kind, active);
	setTimeout(() => {
		if (activeByKind.get(kind) === active) activeByKind.delete(kind);
		active.stop();
	}, 3000);
}

export const SOUND_LABELS: Record<string, string> = {
	suspense: 'Suspense',
	jump: 'Jump Scare',
	applause: 'Applause',
	boo: 'Boo'
};

export const SOUND_PRESETS: { id: string; label: string; description: string }[] = [
	{ id: 'suspense', label: 'Suspense', description: 'Slow tension swell for the quiet parts' },
	{ id: 'jump', label: 'Jump Scare', description: 'Sharp sting for the loud moment' },
	{ id: 'applause', label: 'Applause', description: 'Celebrate a great scene with the room' },
	{ id: 'boo', label: 'Boo', description: 'For bad decisions on screen' }
];