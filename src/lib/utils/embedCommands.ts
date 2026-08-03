export type EmbedCommand = 'play' | 'pause' | 'seekto' | 'setvolume' | 'mute' | 'unmute';

export const PLAYER_SHORTCUTS = [
	{ key: 'Space / K', action: 'Play / Pause' },
	{ key: '← / →', action: 'Seek 10 seconds' },
	{ key: '↑ / ↓', action: 'Volume' },
	{ key: 'M', action: 'Mute / Unmute' },
	{ key: 'F', action: 'Fullscreen' },
	{ key: 'N', action: 'Next episode (TV)' },
	{ key: '?', action: 'Show this help' }
] as const;

export function sendEmbedCommand(
	frame: HTMLIFrameElement | null,
	command: EmbedCommand,
	value?: number
) {
	if (!frame?.contentWindow) return;
	const message: Record<string, unknown> = { type: command };
	if (value !== undefined) message.value = value;
	frame.contentWindow.postMessage(message, '*');
}

export function extractYoutubeId(url: string): string | null {
	const match = url.match(
		/(?:youtube\.com\/embed\/|youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{6,})/
	);
	return match ? match[1] : null;
}

export function loadYoutubeApi(): Promise<void> {
	const w = window as unknown as {
		YT?: { Player?: unknown };
	};
	if (w.YT?.Player) return Promise.resolve();

	let ytApiPromise: Promise<void> | null = null;
	if (!ytApiPromise) {
		ytApiPromise = new Promise((resolve, reject) => {
			const tag = document.createElement('script');
			tag.src = 'https://www.youtube.com/iframe_api';
			tag.async = true;
			tag.onload = () => {
				const check = () => {
					if (w.YT?.Player) {
						resolve();
					} else {
						setTimeout(check, 50);
					}
				};
				check();
			};
			tag.onerror = () => reject(new Error('Failed to load YouTube API'));
			document.head.appendChild(tag);
		});
	}
	return ytApiPromise;
}
