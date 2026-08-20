<script lang="ts">
	import { onMount } from 'svelte';
	import { fade, fly } from 'svelte/transition';
	import { page } from '$app/state';
	import { preferences } from '$lib/state/stores/preferencesStore';
	import {
		fetchDailyQuote,
		QUOTE_CATEGORIES,
		QUOTE_CATEGORY_LABELS,
		type DailyQuoteClient
	} from '$lib/state/stores/dailyQuotes.svelte';
	import { savedQuotesStore, type SavedQuote } from '$lib/state/stores/savedQuotesStore.svelte';
	import { Quote, Bookmark, Check, X, Loader2, LogIn } from '@lucide/svelte';

	let { onclose }: { onclose: () => void } = $props();

	let category = $state<DailyQuoteClient['category']>(preferences.getSnapshot().quoteCategory);
	let quote = $state<DailyQuoteClient | null>(null);
	let loading = $state(false);
	let loadError = $state(false);
	let saveState = $state<'idle' | 'saving' | 'saved' | 'error'>('idle');
	let savedCount = $state(0);

	let overlayEl: HTMLElement;

	async function load(cat: DailyQuoteClient['category']) {
		loading = true;
		loadError = false;
		quote = null;
		saveState = 'idle';
		try {
			quote = await fetchDailyQuote(cat);
		} catch {
			loadError = true;
		} finally {
			loading = false;
		}
	}

	function selectCategory(cat: DailyQuoteClient['category']) {
		category = cat;
		preferences.setPreference('quoteCategory', cat);
		load(cat);
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
		if (saved) {
			saveState = 'saved';
			savedCount += 1;
		} else {
			saveState = 'error';
		}
	}

	function onKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') onclose();
	}

	onMount(() => {
		const prevOverflow = document.body.style.overflow;
		document.body.style.overflow = 'hidden';
		savedQuotesStore.getQuotes().then((list: SavedQuote[]) => {
			savedCount = list.length;
		});
		load(category);
		return () => {
			document.body.style.overflow = prevOverflow;
		};
	});
</script>

<svelte:window onkeydown={onKeydown} />

<div
	class="dq-overlay"
	role="dialog"
	aria-modal="true"
	aria-label="Daily Quotes"
	bind:this={overlayEl}
	onkeydown={onKeydown}
	onclick={(e) => {
		if (e.target === overlayEl) onclose();
	}}
	transition:fade={{ duration: 150 }}
>
	<div class="dq-card" transition:fly={{ y: 16, duration: 200 }}>
		<div class="dq-head">
			<div class="dq-title">
				<Quote size={18} aria-hidden="true" />
				<h2>Daily Quotes</h2>
			</div>
			<button class="dq-close" type="button" onclick={onclose} aria-label="Close daily quotes">
				<X size={18} aria-hidden="true" />
			</button>
		</div>

		<div class="dq-cats" role="group" aria-label="Quote category">
			{#each QUOTE_CATEGORIES as cat (cat)}
				<button
					type="button"
					class="dq-cat"
					class:active={category === cat}
					onclick={() => selectCategory(cat)}
					aria-pressed={category === cat}
				>
					{QUOTE_CATEGORY_LABELS[cat]}
				</button>
			{/each}
		</div>

		<div class="dq-body">
			{#if loading}
				<div class="dq-loading" aria-live="polite">
					<Loader2 class="animate-spin" size={20} aria-hidden="true" />
					<span>Fetching today’s quote…</span>
				</div>
			{:else if loadError}
				<div class="dq-error">
					<p>Couldn’t load a quote right now.</p>
					<button type="button" class="dq-retry" onclick={() => load(category)}> Try again </button>
				</div>
			{:else if quote}
				<blockquote class="dq-quote">
					“{quote.quote}”
				</blockquote>
				<p class="dq-author">— {quote.author}</p>
				<p class="dq-meta">
					{QUOTE_CATEGORY_LABELS[quote.category]} · {quote.day}
					{#if quote.source === 'fallback'}
						<span class="dq-source">curated</span>
					{/if}
				</p>
			{/if}
		</div>

		<div class="dq-actions">
			{#if !page.data.user}
				<a class="dq-login" href="/login">
					<LogIn size={14} aria-hidden="true" />
					Sign in to save quotes
				</a>
			{:else if quote}
				<button
					type="button"
					class="dq-save"
					disabled={saveState === 'saving' || saveState === 'saved'}
					onclick={saveQuote}
				>
					{#if saveState === 'saved'}
						<Check size={15} aria-hidden="true" />
						Saved
					{:else}
						<Bookmark size={15} aria-hidden="true" />
						{saveState === 'saving' ? 'Saving…' : 'Save quote'}
					{/if}
				</button>
			{/if}
			{#if savedCount > 0}
				<a class="dq-library" href="/profile">
					{savedCount} saved in your profile
				</a>
			{/if}
		</div>
	</div>
</div>

<style>
	.dq-overlay {
		position: fixed;
		inset: 0;
		z-index: 600;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 1rem;
		background: rgba(0, 0, 0, 0.6);
		backdrop-filter: blur(4px);
	}

	.dq-card {
		width: 100%;
		max-width: 520px;
		max-height: min(80vh, 640px);
		overflow-y: auto;
		padding: 1.25rem;
		border-radius: var(--radius-xl);
		background: var(--bg-card);
		border: 1px solid var(--border-stream);
		box-shadow: 0 24px 60px rgba(0, 0, 0, 0.4);
	}

	.dq-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: 1rem;
	}

	.dq-title {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		color: var(--accent-color, #818cf8);
	}

	.dq-title h2 {
		font-size: 1.15rem;
		font-weight: var(--font-weight-semibold);
		margin: 0;
	}

	.dq-close {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 32px;
		height: 32px;
		border-radius: var(--radius-md);
		border: 1px solid var(--border-stream);
		background: transparent;
		color: var(--text-secondary);
		cursor: pointer;
	}

	.dq-close:hover {
		color: var(--text-primary);
	}

	.dq-cats {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
		margin-bottom: 1rem;
	}

	.dq-cat {
		padding: 0.4rem 0.85rem;
		border-radius: var(--radius-full);
		border: 1px solid var(--border-stream);
		background: transparent;
		color: var(--text-secondary);
		font-size: 0.85rem;
		font-weight: var(--font-weight-medium);
		cursor: pointer;
		transition:
			background 0.15s ease,
			color 0.15s ease,
			border-color 0.15s ease;
	}

	.dq-cat:hover {
		border-color: var(--accent-color, #818cf8);
		color: var(--text-primary);
	}

	.dq-cat.active {
		background: var(--gradient-brand);
		border-color: transparent;
		color: white;
	}

	.dq-body {
		min-height: 96px;
	}

	.dq-loading {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		color: var(--text-secondary);
		font-size: 0.9rem;
	}

	.dq-error {
		color: var(--text-secondary);
		font-size: 0.9rem;
	}

	.dq-retry {
		margin-top: 0.5rem;
		padding: 0.4rem 0.9rem;
		border-radius: var(--radius-md);
		border: 1px solid var(--border-stream);
		background: transparent;
		color: var(--accent-color, #818cf8);
		font-weight: var(--font-weight-semibold);
		cursor: pointer;
	}

	.dq-quote {
		margin: 0;
		font-size: 1.3rem;
		line-height: 1.5;
		font-weight: var(--font-weight-medium);
		color: var(--text-primary);
		quotes: none;
	}

	.dq-author {
		margin-top: 0.75rem;
		text-align: right;
		font-size: 0.95rem;
		font-weight: var(--font-weight-semibold);
		color: var(--text-secondary);
	}

	.dq-meta {
		margin-top: 0.35rem;
		font-size: 0.75rem;
		color: var(--text-tertiary, var(--text-secondary));
		text-transform: capitalize;
	}

	.dq-source {
		margin-left: 0.4rem;
		padding: 0.05rem 0.4rem;
		border-radius: var(--radius-full);
		background: var(--bg-root);
		border: 1px solid var(--border-stream);
		font-size: 0.65rem;
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	.dq-actions {
		display: flex;
		align-items: center;
		justify-content: space-between;
		flex-wrap: wrap;
		gap: 0.6rem;
		margin-top: 1.25rem;
	}

	.dq-save {
		display: inline-flex;
		align-items: center;
		gap: 0.45rem;
		padding: 0.5rem 1.1rem;
		border-radius: var(--radius-md);
		background: var(--gradient-brand);
		border: none;
		color: white;
		font-weight: var(--font-weight-semibold);
		font-size: 0.9rem;
		cursor: pointer;
	}

	.dq-save:disabled {
		opacity: 0.75;
		cursor: default;
	}

	.dq-login {
		display: inline-flex;
		align-items: center;
		gap: 0.45rem;
		color: var(--accent-color, #818cf8);
		font-size: 0.9rem;
		font-weight: var(--font-weight-semibold);
		text-decoration: none;
	}

	.dq-library {
		font-size: 0.85rem;
		color: var(--text-secondary);
		text-decoration: none;
	}

	.dq-library:hover {
		color: var(--accent-color, #818cf8);
	}
</style>
