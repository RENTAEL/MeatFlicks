<script lang="ts">
	import { onMount } from 'svelte';
	import { fade } from 'svelte/transition';
	import { browser } from '$app/environment';
	import { page } from '$app/state';
	import { Quote as QuoteIcon, Bookmark, Check, LogIn, Sparkles, Shuffle } from '@lucide/svelte';
import { preferences } from '$lib/state/stores/preferencesStore';
import {
		fetchDailyQuote,
		QUOTE_CATEGORY_LABELS,
		type DailyQuoteClient
	} from '$lib/state/stores/dailyQuotes.svelte';
	import { savedQuotesStore, type SavedQuote } from '$lib/state/stores/savedQuotesStore.svelte';
	import ShareButton from '$lib/components/utils/ShareButton.svelte';
	import { buildQuoteShareUrl } from '$lib/utils/quoteShare';
	import { getFallbackQuote } from '$lib/quotes/fallbackQuotes';
	import { getBranding } from '$lib/utils/branding';
	import { impersonationStore } from '$lib/state/stores/impersonationStore.svelte.ts';
	import { Copy, Check as CheckCopy } from '@lucide/svelte';

	let { onopen }: { onopen: () => void } = $props();

	let category = $state<DailyQuoteClient['category']>(preferences.getSnapshot().quoteCategory);
	let quote = $state<DailyQuoteClient | null>(null);
	let loading = $state(true);
	let loadError = $state(false);
	let saveState = $state<'idle' | 'saving' | 'saved' | 'error'>('idle');
	let savedCount = $state(0);
	let copied = $state(false);
	let copyTimeout: ReturnType<typeof setTimeout> | null = null;

	const effectiveUserForQuote = $derived(impersonationStore.current ?? page.data.user);
	const isSuneQuote = $derived(
		!!effectiveUserForQuote && getBranding({ displayName: effectiveUserForQuote.username, email: effectiveUserForQuote.email ?? null }) === 'sune'
	);

	const shareUrl = $derived(
		quote ? new URL(buildQuoteShareUrl(quote), page.url.origin).toString() : ''
	);

	async function load(cat: DailyQuoteClient['category']) {
		loading = true;
		loadError = false;
		try {
			quote = await fetchDailyQuote(cat);
		} catch {
			// Client store now guarantees a quote, but keep UI never-blank as safety net
			const day = new Date().toISOString().slice(0, 10);
			const fallback = getFallbackQuote(cat, day);
			quote = { quote: fallback.quote, author: fallback.author, category: cat, day, source: 'fallback' };
		} finally {
			loading = false;
		}
	}

	function shuffle() {
		const keys = Object.keys(QUOTE_CATEGORY_LABELS) as DailyQuoteClient['category'][];
		const next = keys[Math.floor(Math.random() * keys.length)];
		preferences.setPreference('quoteCategory', next);
		category = next;
		void load(next);
	}

	async function copyQuote() {
		if (!quote) return;
		const text = `"${quote.quote}" — ${quote.author}`;
		try {
			await navigator.clipboard.writeText(text);
			copied = true;
			if (copyTimeout) clearTimeout(copyTimeout);
			copyTimeout = setTimeout(() => (copied = false), 1800);
		} catch {
			// fallback: try execCommand
			try {
				const ta = document.createElement('textarea');
				ta.value = text;
				document.body.appendChild(ta);
				ta.select();
				document.execCommand('copy');
				ta.remove();
				copied = true;
				if (copyTimeout) clearTimeout(copyTimeout);
				copyTimeout = setTimeout(() => (copied = false), 1800);
			} catch {}
		}
	}

	function refreshQuote() {
		// Respect daily cache: shuffle to a new category (each category cached per day)
		// so we get a fresh curated quote without breaking the daily stability
		shuffle();
	}

	async function saveQuote() {
		if (!quote) return;
		if (!page.data.user) {
			window.location.href = '/login';
			return;
		}
		saveState = 'saving';
		const saved = await savedQuotesStore.saveQuote({
			quoteText: quote.quote,
			quoteAuthor: quote.author,
			category: quote.category
		});
		saveState = saved ? 'saved' : 'error';
		if (saved) savedCount += 1;
	}

	onMount(() => {
		void load(category);
		savedQuotesStore
			.getQuotes()
			.then((list: SavedQuote[]) => (savedCount = list.length))
			.catch(() => {});
		// Reflect category changes made inside the full modal.
		const unsub = preferences.subscribe(() => {
			const next = preferences.getSnapshot().quoteCategory;
			if (next !== category) {
				category = next;
				void load(next);
			}
		});
		return unsub;
	});

	// Keep in sync if the store changes elsewhere (e.g. modal).
	$effect(() => {
		if (!browser) return;
		const snap = preferences.getSnapshot().quoteCategory;
		if (snap !== category && !loading) {
			category = snap;
			void load(snap);
		}
	});
</script>

<section class="dq-hero" class:sune-quote={isSuneQuote} aria-label="Daily quote">
	<div class="dq-glow" aria-hidden="true"></div>
	{#if isSuneQuote}
		<div class="dq-rose-motif" aria-hidden="true">❦</div>
	{/if}
	<QuoteIcon class="dq-mark" size={84} aria-hidden="true" strokeWidth={1.5} />

	<div class="dq-content">
		<div class="dq-eyebrow">
			<Sparkles size={14} aria-hidden="true" />
			<span>Quote of the day</span>
			<span class="dq-dot" aria-hidden="true">·</span>
			<span class="dq-cat-label">{QUOTE_CATEGORY_LABELS[category]}</span>
		</div>

		{#if loading}
			<div class="dq-skeleton" aria-live="polite">
				<div class="dq-bar dq-bar-1"></div>
				<div class="dq-bar dq-bar-2"></div>
			</div>
		{:else if loadError}
			<p class="dq-fallback">Today’s quote is taking a nap. Try again in a bit.</p>
		{:else if quote}
			<blockquote class="dq-text" transition:fade={{ duration: 220 }}>
				“{quote.quote}”
			</blockquote>
			<footer class="dq-foot">
				<div class="dq-byline">
					<p class="dq-author">— {quote.author}</p>
					<p class="dq-date">
						{quote.day}
						{#if quote.source === 'fallback'}<span class="dq-source">curated</span>{/if}
					</p>
				</div>
				<div class="dq-actions">
					{#if !page.data.user}
						<a class="dq-btn dq-ghost" href="/login">
							<LogIn size={15} aria-hidden="true" /> Sign in to save
						</a>
					{:else}
						<button
							type="button"
							class="dq-btn dq-ghost"
							disabled={saveState === 'saving' || saveState === 'saved'}
							onclick={saveQuote}
						>
							{#if saveState === 'saved'}
								<Check size={15} aria-hidden="true" /> Saved
							{:else}
								<Bookmark size={15} aria-hidden="true" />
								{saveState === 'saving' ? 'Saving…' : 'Save'}
							{/if}
						</button>
					{/if}
					{#if quote}
						<ShareButton
							url={shareUrl}
							title={`Daily ${QUOTE_CATEGORY_LABELS[quote.category]} Quote — Streamium`}
							description={`“${quote.quote}” — ${quote.author}`}
						/>
					{/if}
					<button
						type="button"
						class="dq-btn dq-ghost"
						onclick={onopen}
						aria-label="Browse quote categories"
					>
						All categories
					</button>
					<button
						type="button"
						class="dq-btn dq-ghost dq-shuffle"
						onclick={shuffle}
						aria-label="Surprise me with another category"
					>
						<Shuffle size={15} aria-hidden="true" />
					</button>
					<button
						type="button"
						class="dq-btn dq-ghost"
						onclick={copyQuote}
						aria-label="Copy quote to clipboard"
					>
						{#if copied}
							<CheckCopy size={15} aria-hidden="true" />
							Copied
						{:else}
							<Copy size={15} aria-hidden="true" />
							Copy
						{/if}
					</button>
					{#if isSuneQuote}
						<button
							type="button"
							class="dq-btn dq-ghost"
							onclick={refreshQuote}
							aria-label="New quote (respects daily cache)"
							title="New quote — respects daily cache"
						>
							<Sparkles size={15} aria-hidden="true" />
							New quote
						</button>
					{/if}
				</div>
			</footer>
		{/if}
	</div>
</section>

<style>
	.dq-hero {
		position: relative;
		overflow: hidden;
		margin: 0 0 12px;
		padding: clamp(1.5rem, 4vw, 2.75rem) clamp(1.25rem, 4vw, 3rem);
		border-radius: var(--radius-2xl, 1.25rem);
		border: 1px solid color-mix(in srgb, var(--accent-color, #818cf8) 35%, transparent);
		background:
			radial-gradient(
				120% 140% at 100% 0%,
				color-mix(in srgb, var(--accent-color, #818cf8) 22%, transparent),
				transparent 60%
			),
			linear-gradient(180deg, rgba(255, 255, 255, 0.04), rgba(255, 255, 255, 0.01));
		box-shadow:
			0 20px 50px -20px rgba(0, 0, 0, 0.55),
			inset 0 1px 0 rgba(255, 255, 255, 0.06);
		isolation: isolate;
	}

	.dq-glow {
		position: absolute;
		inset: -40% -10% auto -10%;
		height: 70%;
		background: radial-gradient(
			60% 100% at 20% 0%,
			color-mix(in srgb, var(--gradient-brand-end, #ec4899) 28%, transparent),
			transparent 70%
		);
		filter: blur(40px);
		opacity: 0.5;
		z-index: -1;
		pointer-events: none;
	}

	.dq-mark {
		position: absolute;
		top: -10px;
		right: clamp(0.5rem, 3vw, 2rem);
		color: color-mix(in srgb, var(--accent-color, #818cf8) 30%, transparent);
		z-index: -1;
	}

	.dq-content {
		position: relative;
		max-width: 60ch;
	}

	.dq-eyebrow {
		display: inline-flex;
		align-items: center;
		gap: 0.45rem;
		margin-bottom: 1.1rem;
		font-size: 0.78rem;
		font-weight: 600;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		color: color-mix(in srgb, var(--accent-color, #818cf8) 85%, white);
	}

	.dq-cat-label {
		text-transform: capitalize;
	}

	.dq-dot {
		opacity: 0.5;
	}

	.dq-text {
		margin: 0;
		font-size: clamp(1.4rem, 3.6vw, 2.1rem);
		line-height: 1.45;
		font-weight: 600;
		letter-spacing: -0.01em;
		color: var(--text-primary, #f4f4f5);
		text-wrap: balance;
	}

	.dq-foot {
		display: flex;
		flex-wrap: wrap;
		align-items: flex-end;
		justify-content: space-between;
		gap: 1rem;
		margin-top: 1.4rem;
	}

	.dq-author {
		margin: 0;
		font-size: 1rem;
		font-weight: 600;
		color: var(--text-primary, #f4f4f5);
	}

	.dq-date {
		margin: 0.2rem 0 0;
		font-size: 0.8rem;
		color: var(--text-secondary, #a1a1aa);
	}

	.dq-source {
		margin-left: 0.4rem;
		padding: 0.05rem 0.4rem;
		border-radius: 999px;
		background: rgba(255, 255, 255, 0.06);
		border: 1px solid rgba(255, 255, 255, 0.1);
		font-size: 0.62rem;
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	.dq-actions {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.5rem;
	}

	.dq-btn {
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
		padding: 0.5rem 0.9rem;
		border-radius: var(--radius-md, 0.6rem);
		font-size: 0.85rem;
		font-weight: 600;
		text-decoration: none;
		cursor: pointer;
		border: 1px solid transparent;
		transition:
			background 0.15s ease,
			border-color 0.15s ease,
			color 0.15s ease;
	}

	.dq-ghost {
		background: rgba(255, 255, 255, 0.05);
		border-color: rgba(255, 255, 255, 0.1);
		color: var(--text-secondary, #d4d4d8);
	}

	.dq-ghost:hover {
		color: var(--text-primary, #fff);
		border-color: color-mix(in srgb, var(--accent-color, #818cf8) 60%, transparent);
		background: rgba(255, 255, 255, 0.09);
	}

	.dq-ghost:disabled {
		opacity: 0.7;
		cursor: default;
	}

	.dq-shuffle {
		padding-inline: 0.7rem;
	}

	.dq-skeleton {
		display: flex;
		flex-direction: column;
		gap: 0.7rem;
		margin-top: 0.5rem;
	}

	.dq-bar {
		height: 1.2rem;
		border-radius: 999px;
		background: linear-gradient(
			90deg,
			rgba(255, 255, 255, 0.06),
			rgba(255, 255, 255, 0.12),
			rgba(255, 255, 255, 0.06)
		);
		background-size: 200% 100%;
		animation: dq-shimmer 1.3s ease-in-out infinite;
	}

	.dq-bar-1 {
		width: 92%;
	}

	.dq-bar-2 {
		width: 64%;
	}

	.dq-fallback {
		color: var(--text-secondary, #a1a1aa);
		font-size: 1rem;
		margin: 0.5rem 0 0;
	}

	.sune-quote {
		border-color: rgba(212, 175, 55, 0.22) !important;
		background:
			radial-gradient(ellipse 90% 60% at 10% 20%, rgba(212, 175, 55, 0.08) 0%, transparent 60%),
			linear-gradient(180deg, rgba(142, 29, 46, 0.06), transparent) !important;
		box-shadow:
			0 8px 32px rgba(0, 0, 0, 0.45),
			0 0 24px rgba(212, 175, 55, 0.08) !important;
	}

	.sune-quote .dq-text {
		font-family: 'Playfair Display', Georgia, serif;
		letter-spacing: -0.01em;
		text-shadow: 0 0 12px rgba(212, 175, 55, 0.1);
	}

	.dq-rose-motif {
		position: absolute;
		top: 50%;
		right: 1.2rem;
		transform: translateY(-50%);
		font-size: 3.2rem;
		color: #d4af37;
		opacity: 0.07;
		pointer-events: none;
		z-index: 0;
	}

	@keyframes dq-shimmer {
		0% {
			background-position: 200% 0;
		}
		100% {
			background-position: -200% 0;
		}
	}

	@media (max-width: 540px) {
		.dq-foot {
			align-items: flex-start;
		}
		.dq-mark {
			opacity: 0.6;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.dq-bar {
			animation: none;
		}
	}
</style>
