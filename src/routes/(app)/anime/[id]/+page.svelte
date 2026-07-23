<script lang="ts">
	import { Play, Star, Clock, Tv, Film } from '@lucide/svelte';
	import { Badge } from '$lib/components/ui/badge';
	import { SEOHead } from '$lib/components/seo';
	import InlinePlayer from '$lib/components/player/InlinePlayer.svelte';
	import HlsPlayer from '$lib/components/player/HlsPlayer.svelte';
	import AnimeScrollRow from '$lib/components/anime/AnimeScrollRow.svelte';

	let { data } = $props<{ data: { info: any; episodes: any[]; totalEpisodes: number } }>();

	let info = $derived(data.info);
	let episodes = $derived(data.episodes ?? []);

	let selectedEpIndex = $state(0);
	let subOrDub = $state<'sub' | 'dub'>('sub');
	let activeEmbedUrl = $state<string | null>(null);
	let isLoadingSrc = $state(false);
	let activeEpTitle = $state('');
	let playerMode = $state<'embed' | 'hls'>('embed');

	let selectedEpisode = $derived(episodes[selectedEpIndex]);
	let sortedEpisodes = $derived([...episodes].sort((a: any, b: any) => a.number - b.number));
	let malId = $derived.by(() => {
		if (!info?.otherInfo) return undefined;
		for (const tag of info.otherInfo) {
			const m = String(tag).match(/MAL[:\s]*(\d+)/i);
			if (m) return Number(m[1]);
		}
		return undefined;
	});

	async function handlePlayEpisode(ep: any) {
		if (!ep?.episodeId) return;
		activeEpTitle = `${info?.name ?? 'Anime'} - Episode ${ep.number}`;
		isLoadingSrc = true;
		activeEmbedUrl = null;

		try {
			const res = await fetch(`/api/anime/episode-srcs?id=${ep.episodeId}&server=hd-1&category=${subOrDub}`);
			if (!res.ok) throw new Error(`API error ${res.status}`);
			const srcData = await res.json();
			const m3u8Url = srcData.sources?.find((s: any) => s.isM3U8)?.url ?? srcData.sources?.[0]?.url;
			if (m3u8Url) {
				activeEmbedUrl = m3u8Url;
				playerMode = m3u8Url.endsWith('.m3u8') ? 'hls' : 'embed';
			}
		} catch (e) {
			console.error('[anime] Failed to get episode source:', e);
		} finally {
			isLoadingSrc = false;
		}
	}

	function closePlayer() {
		activeEmbedUrl = null;
	}
</script>

<SEOHead
	title={info?.name ?? 'Anime - Streamium'}
	description={info?.description ?? 'Watch anime on Streamium'}
/>

<div class="anime-page page-transition min-h-screen text-foreground">
	<main class="mx-auto w-full py-2 pr-2 pl-0 sm:pr-2 sm:pl-0 lg:pr-2 lg:pl-0">
		<div class="flex min-h-[calc(100vh-2rem)] flex-col gap-8 rounded-2xl glass shadow-xl p-6">
			{#if info}
				<!-- Hero Section -->
				<div class="relative flex flex-col gap-8 lg:flex-row">
					<div class="w-full shrink-0 lg:w-72">
						<img
							src={info.poster}
							alt={info.name}
							class="w-full rounded-xl shadow-lg"
						/>
					</div>

					<div class="flex flex-1 flex-col justify-center">
						<h1 class="text-3xl font-bold text-foreground md:text-4xl">{info.name}</h1>
						{#if info.jname && info.jname !== info.name}
							<p class="mt-1 text-sm text-muted-foreground">{info.jname}</p>
						{/if}

						<div class="mt-4 flex flex-wrap items-center gap-3">
							{#if info.stats?.rating}
								<Badge class="flex items-center gap-1 bg-pink-600 text-white">
									<Star class="size-3.5" />
									{info.stats.rating}
								</Badge>
							{/if}
							{#if info.stats?.type}
								<Badge variant="outline" class="border-pink-500/30 text-foreground">
									<Tv class="size-3.5" />
									{info.stats.type}
								</Badge>
							{/if}
							{#if info.stats?.duration}
								<Badge variant="outline" class="border-pink-500/30 text-foreground">
									<Clock class="size-3.5" />
									{info.stats.duration}
								</Badge>
							{/if}
							{#if info.stats?.episodes?.sub}
								<Badge variant="outline" class="border-pink-500/30 text-foreground">
									<Film class="size-3.5" />
									{info.stats.episodes.sub} EP
								</Badge>
							{/if}
						</div>

						{#if info.otherInfo?.length}
							<div class="mt-3 flex flex-wrap gap-2">
								{#each info.otherInfo as tag}
									<span class="rounded-full bg-muted/50 px-3 py-1 text-xs text-muted-foreground">{tag}</span>
								{/each}
							</div>
						{/if}

						{#if info.description}
							<p class="mt-4 text-sm leading-relaxed text-muted-foreground line-clamp-4">
								{info.description}
							</p>
						{/if}

						<!-- Sub/Dub Toggle -->
						<div class="mt-5 flex items-center gap-3">
							<span class="text-sm font-medium text-muted-foreground">Audio:</span>
							<div class="flex rounded-md bg-muted p-1">
								<button
									class="rounded px-4 py-1.5 text-sm font-medium transition-all {subOrDub === 'sub' ? 'bg-pink-600 text-white shadow-sm' : 'text-muted-foreground hover:text-foreground'}"
									onclick={() => (subOrDub = 'sub')}
								>
									Sub
								</button>
								<button
									class="rounded px-4 py-1.5 text-sm font-medium transition-all {subOrDub === 'dub' ? 'bg-pink-600 text-white shadow-sm' : 'text-muted-foreground hover:text-foreground'}"
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
					<h2 class="mb-4 text-2xl font-bold text-foreground">
						Episodes ({data.totalEpisodes})
					</h2>

					<div class="flex flex-wrap gap-2 max-h-[400px] overflow-y-auto scrollbar-thin">
						{#each sortedEpisodes as ep, i}
							<button
								type="button"
								class="flex items-center gap-2 rounded-lg border px-4 py-2 text-sm transition-all {i === selectedEpIndex
									? 'border-pink-500 bg-pink-600/20 text-pink-300'
									: 'border-border/40 text-muted-foreground hover:border-pink-500/40 hover:text-foreground'}"
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
				</section>

				<!-- Related Anime -->
				{#if info.relatedAnimes?.length}
					<section>
						<h2 class="mb-4 text-2xl font-bold text-foreground">Related</h2>
						<AnimeScrollRow title="" items={info.relatedAnimes} />
					</section>
				{/if}

				{#if info.recommendedAnimes?.length}
					<section>
						<h2 class="mb-4 text-2xl font-bold text-foreground">Recommended</h2>
						<AnimeScrollRow title="" items={info.recommendedAnimes} />
					</section>
				{/if}
			{:else}
				<div class="flex min-h-[50vh] items-center justify-center">
					<p class="text-muted-foreground">Anime not found.</p>
				</div>
			{/if}
		</div>
	</main>
</div>

{#if activeEmbedUrl}
	{#if playerMode === 'hls'}
		<HlsPlayer src={activeEmbedUrl} title={activeEpTitle} malId={malId} episode={selectedEpisode?.number} onClose={closePlayer} />
	{:else}
		<InlinePlayer src={activeEmbedUrl} title={activeEpTitle} onClose={closePlayer} />
	{/if}
{/if}
