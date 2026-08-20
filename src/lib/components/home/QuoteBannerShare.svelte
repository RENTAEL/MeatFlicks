<script lang="ts">
	import { onMount } from 'svelte';
	import { Share2, Download, Loader2, Check, Instagram, Link2 } from '@lucide/svelte';
	import type { DailyQuoteClient } from '$lib/state/stores/dailyQuotes.svelte';
	import { QUOTE_CATEGORY_LABELS } from '$lib/state/stores/dailyQuotes.svelte';
	import {
		renderQuoteBanner,
		downloadQuoteBanner,
		shareQuoteBanner,
		QUOTE_BANNER_CTA
	} from '$lib/utils/quoteBanner';

	let { quote, shareUrl }: { quote: DailyQuoteClient; shareUrl: string } = $props();

	let imageUrl = $state('');
	let busy = $state(false);
	let copied = $state(false);
	let status = $state<'idle' | 'shared' | 'downloaded' | 'failed' | 'cancelled'>('idle');

	const title = $derived(`Daily ${QUOTE_CATEGORY_LABELS[quote.category]} Quote — Streamium`);
	const description = $derived(`“${quote.quote}” — ${quote.author}`);

	onMount(() => {
		let disposed = false;
		renderQuoteBanner(quote, shareUrl)
			.then((blob) => {
				if (disposed) {
					URL.revokeObjectURL(URL.createObjectURL(blob));
					return;
				}
				imageUrl = URL.createObjectURL(blob);
			})
			.catch(() => {
				// banner preview unavailable — buttons still work on demand
			});
		return () => {
			disposed = true;
			if (imageUrl) URL.revokeObjectURL(imageUrl);
		};
	});

	async function handleShare() {
		if (busy) return;
		busy = true;
		try {
			status = await shareQuoteBanner(quote, { title, text: description, url: shareUrl });
		} catch {
			status = 'failed';
		} finally {
			busy = false;
		}
	}

	async function handleDownload() {
		if (busy) return;
		busy = true;
		try {
			await downloadQuoteBanner(quote, shareUrl);
			status = 'downloaded';
		} catch {
			status = 'failed';
		} finally {
			busy = false;
		}
	}

	async function handleCopyLink() {
		try {
			await navigator.clipboard.writeText(shareUrl);
			copied = true;
			setTimeout(() => {
				copied = false;
			}, 2000);
		} catch {
			status = 'failed';
		}
	}
</script>

<div class="quote-banner-share">
	{#if imageUrl}
		<figure class="banner-figure">
			<img
				class="banner-img"
				src={imageUrl}
				alt={`Daily ${QUOTE_CATEGORY_LABELS[quote.category]} quote banner`}
			/>
		</figure>
	{/if}

	<p class="banner-cta">
		<Instagram class="size-4" aria-hidden="true" />
		{QUOTE_BANNER_CTA} — open {shareUrl}
	</p>

	<div class="banner-actions">
		<button
			type="button"
			class="banner-btn banner-btn-primary"
			onclick={handleShare}
			disabled={busy}
		>
			{#if busy}
				<Loader2 class="size-4 animate-spin" aria-hidden="true" />
			{:else if status === 'shared'}
				<Check class="size-4" aria-hidden="true" />
			{:else}
				<Share2 class="size-4" aria-hidden="true" />
			{/if}
			{status === 'shared' ? 'Shared!' : 'Share image'}
		</button>
		<button type="button" class="banner-btn" onclick={handleDownload} disabled={busy}>
			<Download class="size-4" aria-hidden="true" />
			Save image
		</button>
		<button type="button" class="banner-btn" onclick={handleCopyLink}>
			{#if copied}
				<Check class="size-4" aria-hidden="true" />
			{:else}
				<Link2 class="size-4" aria-hidden="true" />
			{/if}
			{copied ? 'Copied!' : 'Copy link'}
		</button>
	</div>

	{#if status === 'downloaded'}
		<p class="banner-status">
			Image saved — the QR on it opens the site. When posting to Instagram Stories, add the link
			sticker with the copied link for a direct tap-through.
		</p>
	{:else if status === 'failed'}
		<p class="banner-status banner-status-error">
			Couldn’t share the image — try saving it instead.
		</p>
	{/if}
</div>

<style>
	.quote-banner-share {
		display: flex;
		flex-direction: column;
		gap: 0.65rem;
		margin-top: 0.5rem;
	}

	.banner-figure {
		margin: 0;
		display: flex;
		justify-content: center;
	}

	.banner-img {
		width: min(100%, 260px);
		border-radius: var(--radius-lg);
		border: 1px solid var(--border-stream);
		box-shadow: var(--shadow-md);
	}

	.banner-cta {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.4rem;
		margin: 0;
		font-size: 0.8rem;
		color: var(--text-secondary);
		text-align: center;
	}

	.banner-actions {
		display: flex;
		align-items: center;
		justify-content: center;
		flex-wrap: wrap;
		gap: 0.5rem;
	}

	.banner-btn {
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
		padding: 0.45rem 1rem;
		border-radius: var(--radius-full);
		border: 1px solid var(--border-stream);
		background: var(--bg-elevated);
		color: var(--text-primary);
		font-size: 0.85rem;
		font-weight: var(--font-weight-semibold);
		cursor: pointer;
	}

	.banner-btn-primary {
		background: var(--gradient-brand);
		border-color: transparent;
		color: #fff;
	}

	.banner-btn:disabled {
		opacity: 0.7;
		cursor: default;
	}

	.banner-status {
		margin: 0;
		text-align: center;
		font-size: 0.78rem;
		color: var(--accent-color, #818cf8);
	}

	.banner-status-error {
		color: var(--destructive, #ef4444);
	}
</style>
