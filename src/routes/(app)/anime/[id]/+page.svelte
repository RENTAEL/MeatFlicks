<script lang="ts">
	import { Play, Star, Clock, Tv, Film } from '@lucide/svelte';
	import { Badge } from '$lib/components/ui/badge';
	import { SEOHead } from '$lib/components/seo';
	import InlinePlayer from '$lib/components/player/InlinePlayer.svelte';
	import HlsPlayer from '$lib/components/player/HlsPlayer.svelte';
	import AnimeScrollRow from '$lib/components/anime/AnimeScrollRow.svelte';
	import MobileShell from '$lib/components/MobileShell.svelte';
	import { getImageUrl, getSrcSet } from '$lib/utils/image';

	let { data } = $props<{ data: { info: any; episodes: any[]; totalEpisodes: number } }>();

	let info = $derived(data.info);
	let episodes = $derived(data.episodes ?? []);

	let selectedEpIndex = $state(0);
	let subOrDub = $state<'sub' | 'dub'>('sub');
	let activeEmbedUrl = $state<string | null>(null);
	let isLoadingSrc = $state(false);
	let activeEpTitle = $state('');
	let playerMode = $state<'embed' | 'hls'>('embed');
	let showFullOverview = $state(false);
	let sourceError = $state('');

	let selectedEpisode = $derived(episodes[selectedEpIndex]);
	let sortedEpisodes = $derived([...episodes].sort((a: any, b: any) => a.number - b.number));
	let animeId = $derived(info?.id || '');
	let malId = $derived.by(() => {
		if (!info?.otherInfo) return undefined;
		for (const tag of info.otherInfo) {
			const m = String(tag).match(/MAL[:\s]*(\d+)/i);
			if (m) return Number(m[1]);
		}
		return undefined;
	});
	let posterSrc = $derived(getImageUrl(info?.poster, 'w342'));
	let posterSrcset = $derived(getSrcSet(info?.poster));

	async function handlePlayEpisode(ep: any) {
		activeEpTitle = `${info?.name ?? 'Anime'} - Episode ${ep.number}`;
		isLoadingSrc = true;
		activeEmbedUrl = null;
		sourceError = '';

		if (ep?.episodeId) {
			try {
				const res = await fetch(`/api/anime/episode-srcs?id=${ep.episodeId}&server=hd-1&category=${subOrDub}`);
				if (res.ok) {
					const srcData = await res.json();
					const m3u8Url = srcData.sources?.find((s: any) => s.isM3U8)?.url ?? srcData.sources?.[0]?.url;
					if (m3u8Url) {
						activeEmbedUrl = m3u8Url;
						playerMode = m3u8Url.endsWith('.m3u8') ? 'hls' : 'embed';
						isLoadingSrc = false;
						return;
					}
				}
			} catch (e) {
				console.error('[anime] Episode-srcs failed, trying resolve:', e);
			}
		}

		try {
			const epNum = ep?.number || selectedEpIndex + 1;
			const res = await fetch(`/api/anime-resolve?provider=gogoanime&id=${encodeURIComponent(animeId)}&ep=${epNum}`);
			if (!res.ok) {
				const errData = await res.json().catch(() => ({}));
				sourceError = errData.error || `Failed to load (HTTP ${res.status})`;
				return;
			}
			const result = await res.json();
			if (result.url) {
				activeEmbedUrl = result.url;
				playerMode = result.isM3U8 ? 'hls' : 'embed';
			} else {
				sourceError = 'No stream URL returned from provider.';
			}
		} catch (e) {
			console.error('[anime] Resolve failed:', e);
			sourceError = 'Failed to connect to anime provider. Try again.';
		} finally {
			isLoadingSrc = false;
		}
	}

	function handlePlay() {
		if (sortedEpisodes.length > 0) {
			selectedEpIndex = 0;
			handlePlayEpisode(sortedEpisodes[0]);
		} else {
			handlePlayEpisode(null);
		}
	}

	function closePlayer() {
		activeEmbedUrl = null;
		sourceError = '';
	}
</script>

<MobileShell />

<SEOHead
	title={info?.name ?? 'Anime - Streamium'}
	description={info?.description ?? 'Watch anime on Streamium'}
/>

<div class="page-transition mx-auto max-w-4xl px-4 pb-24 pt-20 md:pt-8">
	<a href="/anime" class="mb-4 inline-flex items-center gap-2 text-zinc-400 hover:text-white md:hidden">
		← Back
	</a>

	{#if info}
		<div class="flex flex-col gap-6 md:flex-row md:gap-8">
			<div class="mx-auto w-[180px] shrink-0 md:w-[240px]">
				<img
					src={posterSrc}
					srcset={posterSrcset}
					sizes="(max-width: 640px) 180px, 240px"
					alt={info.name}
					class="aspect-[2/3] w-full rounded-xl object-cover"
					loading="eager"
				/>
			</div>

			<div class="flex flex-col gap-4">
				<h1 class="text-2xl font-bold text-white md:text-3xl">{info.name}</h1>
				{#if info.jname && info.jname !== info.name}
					<p class="text-sm text-zinc-400">{info.jname}</p>
				{/if}

				<div class="flex flex-wrap items-center gap-2 text-sm text-zinc-400">
					{#if info.stats?.rating}
						<Badge class="flex items-center gap-1 bg-pink-600 text-white">
							<Star class="size-3.5" />
							{info.stats.rating}
						</Badge>
					{/if}
					{#if info.stats?.type}
						<Badge variant="outline" class="border-pink-500/30 text-white">
							<Tv class="size-3.5" />
							{info.stats.type}
						</Badge>
					{/if}
					{#if info.stats?.duration}
						<Badge variant="outline" class="border-pink-500/30 text-white">
							<Clock class="size-3.5" />
							{info.stats.duration}
						</Badge>
					{/if}
					{#if info.stats?.episodes?.sub}
						<Badge variant="outline" class="border-pink-500/30 text-white">
							<Film class="size-3.5" />
							{info.stats.episodes.sub} EP
						</Badge>
					{/if}
				</div>

				{#if info.otherInfo?.length}
					<div class="flex flex-wrap gap-2">
						{#each info.otherInfo as tag}
							<span class="rounded-full border border-zinc-700 px-3 py-1 text-xs text-zinc-400">{tag}</span>
						{/each}
					</div>
				{/if}

				<button
					onclick={handlePlay}
					disabled={isLoadingSrc}
					class="w-full rounded-xl bg-indigo-600 py-4 text-center font-semibold text-white transition active:scale-95 hover:bg-indigo-500 disabled:opacity-50 md:w-48"
				>
					{#if isLoadingSrc}
						<span class="inline-block size-4 animate-spin rounded-full border-2 border-white border-t-transparent"></span>
						Loading...
					{:else}
						▶ Watch
					{/if}
				</button>

				{#if sourceError}
					<div class="rounded-lg border border-red-800 bg-red-900/30 p-3 text-sm text-red-400">
						{sourceError}
					</div>
				{/if}

				{#if info.description}
					<div class="text-sm text-zinc-400">
						<p class:line-clamp-4={!showFullOverview}>{info.description}</p>
						{#if info.description.length > 200}
							<button class="mt-1 text-indigo-400 md:hidden" onclick={() => (showFullOverview = !showFullOverview)}>
								{showFullOverview ? 'Show less' : 'Read more'}
							</button>
						{/if}
					</div>
				{/if}

				<div class="flex items-center gap-3">
					<span class="text-sm font-medium text-zinc-400">Audio:</span>
					<div class="flex rounded-md bg-zinc-800 p-1">
						<button
							class="rounded px-4 py-1.5 text-sm font-medium transition-all {subOrDub === 'sub' ? 'bg-pink-600 text-white shadow-sm' : 'text-zinc-400 hover:text-white'}"
							onclick={() => (subOrDub = 'sub')}
						>
							Sub
						</button>
						<button
							class="rounded px-4 py-1.5 text-sm font-medium transition-all {subOrDub === 'dub' ? 'bg-pink-600 text-white shadow-sm' : 'text-zinc-400 hover:text-white'}"
							onclick={() => (subOrDub = 'dub')}
						>
							Dub
						</button>
					</div>
				</div>
			</div>
		</div>

		<!-- Episode List -->
		<section>
			<h2 class="mb-4 text-2xl font-bold text-white">
				Episodes ({data.totalEpisodes})
			</h2>
			{#if sortedEpisodes.length === 0}
				{@const statusTag = info?.otherInfo?.find((t: string) => ['FINISHED', 'RELEASING', 'NOT_YET_RELEASED', 'CANCELLED', 'HIATUS'].includes(t))}
				{#if statusTag === 'NOT_YET_RELEASED'}
					<p class="text-zinc-500">This title hasn't been released yet. Episodes will be available after release.</p>
				{:else if statusTag === 'RELEASING'}
					<p class="text-zinc-500">No episodes available yet. Check back soon.</p>
				{:else if statusTag === 'CANCELLED' || statusTag === 'HIATUS'}
					<p class="text-zinc-500">This title is not currently airing. No episodes available.</p>
				{:else}
					<p class="text-zinc-500">No episodes found for this title.</p>
				{/if}
			{:else}
				<div class="flex flex-wrap gap-2 max-h-[400px] overflow-y-auto scrollbar-thin">
					{#each sortedEpisodes as ep, i}
						<button
							type="button"
							class="flex items-center gap-2 rounded-lg border px-4 py-2 text-sm transition-all {i === selectedEpIndex
								? 'border-pink-500 bg-pink-600/20 text-pink-300'
								: 'border-zinc-700 text-zinc-400 hover:border-pink-500/40 hover:text-white'}"
							onclick={() => {
								selectedEpIndex = i;
								handlePlayEpisode(ep);
							}}
						>
							<Play class="size-3.5" />
							<span>EP {ep.number}{ep.isFiller ? ' (Filler)' : ''}</span>
						</button>
					{/each}
				</div>
			{/if}
		</section>

		{#if info.relatedAnimes?.length}
			<section>
				<h2 class="mb-4 text-2xl font-bold text-white">Related</h2>
				<AnimeScrollRow title="" items={info.relatedAnimes} />
			</section>
		{/if}

		{#if info.recommendedAnimes?.length}
			<section>
				<h2 class="mb-4 text-2xl font-bold text-white">Recommended</h2>
				<AnimeScrollRow title="" items={info.recommendedAnimes} />
			</section>
		{/if}
	{:else}
		<div class="flex min-h-[50vh] items-center justify-center">
			<p class="text-zinc-400">Anime not found.</p>
		</div>
	{/if}
</div>

{#if activeEmbedUrl}
	{#if playerMode === 'hls'}
		<HlsPlayer src={activeEmbedUrl} title={activeEpTitle} malId={malId} episode={selectedEpisode?.number} onClose={closePlayer} />
	{:else}
		<InlinePlayer src={activeEmbedUrl} title={activeEpTitle} onClose={closePlayer} />
	{/if}
{/if}
