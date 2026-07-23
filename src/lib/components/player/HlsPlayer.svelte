<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { X, SkipForward, SkipBack, AlertCircle } from '@lucide/svelte';
	import { Button } from '$lib/components/ui/button';
	import { skipSettings } from '$lib/state/stores/skipSettings.svelte';
	import SkipNotification from './SkipNotification.svelte';

	let {
		src,
		title,
		malId,
		episode,
		onClose
	}: {
		src: string;
		title: string;
		malId?: number;
		episode?: number;
		onClose: () => void;
	} = $props();

	let videoRef = $state<HTMLVideoElement | null>(null);
	let hlsInstance: any = null;
	let skipTimes = $state<{ intro: any; outro: any; recap: any }>({ intro: null, outro: null, recap: null });
	let activeSkip = $state<string | null>(null);
	let skipTimer: ReturnType<typeof setTimeout> | null = null;

	async function loadSkipTimestamps() {
		if (!malId || !episode) return;
		try {
			const res = await fetch(`/api/anime/skip-times?malId=${malId}&episode=${episode}`);
			if (res.ok) skipTimes = await res.json();
		} catch {}
	}

	function checkSkip(time: number) {
		const offset = skipSettings.settings.offsetSeconds;
		const s = skipSettings.settings;

		if (s.autoSkipIntro && skipTimes.intro) {
			const end = skipTimes.intro.end + offset;
			if (time >= skipTimes.intro.start && time < end) {
				if (activeSkip !== 'intro') {
					activeSkip = 'intro';
					if (skipTimer) clearTimeout(skipTimer);
					skipTimer = setTimeout(() => {
						if (videoRef) videoRef.currentTime = end;
						activeSkip = null;
					}, 1500);
				}
				return;
			}
		}
		if (s.autoSkipOutro && skipTimes.outro) {
			const end = skipTimes.outro.end + offset;
			if (time >= skipTimes.outro.start && time < end) {
				if (activeSkip !== 'outro') {
					activeSkip = 'outro';
					if (skipTimer) clearTimeout(skipTimer);
					skipTimer = setTimeout(() => {
						if (videoRef) videoRef.currentTime = end;
						activeSkip = null;
					}, 1500);
				}
				return;
			}
		}
		if (s.autoSkipRecap && skipTimes.recap) {
			const end = skipTimes.recap.end + offset;
			if (time >= skipTimes.recap.start && time < end) {
				if (activeSkip !== 'recap') {
					activeSkip = 'recap';
					if (skipTimer) clearTimeout(skipTimer);
					skipTimer = setTimeout(() => {
						if (videoRef) videoRef.currentTime = end;
						activeSkip = null;
					}, 1500);
				}
				return;
			}
		}

		if (activeSkip) {
			if (skipTimer) clearTimeout(skipTimer);
			activeSkip = null;
		}
	}

	function skipNow() {
		if (!videoRef || !activeSkip) return;
		const key = activeSkip as 'intro' | 'outro' | 'recap';
		const ts = skipTimes[key];
		if (ts) {
			videoRef.currentTime = ts.end + (skipSettings.settings.offsetSeconds);
			activeSkip = null;
		}
	}

	onMount(async () => {
		if (src.endsWith('.m3u8')) {
			try {
				const Hls = (await import('hls.js')).default;
				if (Hls.isSupported() && videoRef) {
					hlsInstance = new Hls();
					hlsInstance.loadSource(src);
					hlsInstance.attachMedia(videoRef);
				}
			} catch (e) {
				console.error('[HlsPlayer] Failed to load HLS:', e);
			}
		}

		await loadSkipTimestamps();
	});

	onDestroy(() => {
		if (hlsInstance) {
			hlsInstance.destroy();
			hlsInstance = null;
		}
		if (skipTimer) clearTimeout(skipTimer);
	});
</script>

<div class="fixed inset-0 z-[100] flex items-center justify-center bg-black/90" role="dialog" aria-label={title}>
	<div class="relative w-full max-w-5xl mx-4">
		<div class="absolute -top-10 right-0 z-10 flex items-center gap-2">
			{#if malId && episode}
				<label class="flex items-center gap-1.5 text-xs text-white/60">
					<input
						type="checkbox"
						checked={skipSettings.settings.autoSkipIntro}
						onchange={(e) => skipSettings.set('autoSkipIntro', e.currentTarget.checked)}
						class="size-3 accent-pink-500"
					/>
					Auto-skip
				</label>
			{/if}
			<span class="text-sm text-white/70 truncate max-w-[300px]">{title}</span>
			<Button type="button" variant="ghost" size="icon" class="text-white/70 hover:text-white hover:bg-white/10" onclick={onClose} aria-label="Close">
				<X class="size-5" />
			</Button>
		</div>

		<video
			bind:this={videoRef}
			class="h-full w-full rounded-lg"
			controls
			autoplay
			playsinline
			ontimeupdate={(e) => checkSkip(e.currentTarget.currentTime)}
		></video>
	</div>

	<SkipNotification
		type={activeSkip ?? 'intro'}
		visible={activeSkip !== null}
		onSkip={skipNow}
	/>
</div>
