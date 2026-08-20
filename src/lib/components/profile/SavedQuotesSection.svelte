<script lang="ts">
	import { onMount } from 'svelte';
	import { savedQuotesStore, type SavedQuote } from '$lib/state/stores/savedQuotesStore.svelte';
	import { QUOTE_CATEGORY_LABELS } from '$lib/state/stores/dailyQuotes.svelte';
	import { Quote, Trash2, Bookmark } from '@lucide/svelte';

	let quotes = $state<SavedQuote[]>([]);
	let loading = $state(true);
	let loadError = $state(false);
	let removing = $state<string[]>([]);

	async function load() {
		loading = true;
		loadError = false;
		try {
			quotes = await savedQuotesStore.getQuotes();
		} catch {
			loadError = true;
		} finally {
			loading = false;
		}
	}

	async function remove(id: string) {
		if (removing.includes(id)) return;
		removing = [...removing, id];
		const ok = await savedQuotesStore.removeQuote(id);
		if (ok) {
			quotes = quotes.filter((q) => q.id !== id);
		}
		removing = removing.filter((r) => r !== id);
	}

	function formatDate(ts: number) {
		return new Date(ts).toLocaleDateString('en-ZA', {
			year: 'numeric',
			month: 'short',
			day: 'numeric'
		});
	}

	onMount(load);
</script>

<section class="section">
	<div class="section-head">
		<h2><Quote size="18" /> Saved Quotes</h2>
	</div>

	{#if loading}
		<p class="empty-state">Loading your saved quotes…</p>
	{:else if loadError}
		<p class="empty-state">Couldn’t load your saved quotes.</p>
	{:else if quotes.length === 0}
		<div class="empty-state">
			<p>
				No saved quotes yet — open <a class="empty-link" href="/">Daily Quotes on the home screen</a
				> and save the ones you love.
			</p>
		</div>
	{:else}
		<ul class="quote-list">
			{#each quotes as q (q.id)}
				<li class="quote-item">
					<blockquote class="quote-text">“{q.quoteText}”</blockquote>
					<div class="quote-meta">
						<span class="quote-author">— {q.quoteAuthor}</span>
						<span class="quote-cat">
							<Bookmark size="12" />
							{QUOTE_CATEGORY_LABELS[q.category as keyof typeof QUOTE_CATEGORY_LABELS] ??
								q.category}
						</span>
						<span class="quote-date">{formatDate(q.createdAt)}</span>
					</div>
					<button
						class="remove-btn"
						type="button"
						aria-label="Remove saved quote"
						disabled={removing.includes(q.id)}
						onclick={() => remove(q.id)}
					>
						<Trash2 size="14" />
					</button>
				</li>
			{/each}
		</ul>
	{/if}
</section>

<style>
	.section {
		margin-top: 1.5rem;
	}

	.section-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: 0.75rem;
	}

	.section-head h2 {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		font-size: 1.1rem;
		font-weight: var(--font-weight-semibold);
		margin: 0;
	}

	.empty-state {
		color: var(--text-secondary);
		line-height: 1.6;
	}

	.empty-link {
		color: var(--accent-color, #818cf8);
		text-decoration: none;
	}

	.empty-link:hover {
		text-decoration: underline;
	}

	.quote-list {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.quote-item {
		position: relative;
		padding: 1rem 3rem 1rem 1rem;
		border-radius: var(--radius-lg);
		background: var(--bg-card);
		border: 1px solid var(--border-stream);
	}

	.quote-text {
		margin: 0;
		font-size: 1.05rem;
		line-height: 1.5;
		color: var(--text-primary);
	}

	.quote-meta {
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		gap: 0.75rem;
		margin-top: 0.6rem;
		font-size: 0.8rem;
		color: var(--text-secondary);
	}

	.quote-author {
		font-weight: var(--font-weight-semibold);
	}

	.quote-cat {
		display: inline-flex;
		align-items: center;
		gap: 0.25rem;
		padding: 0.1rem 0.5rem;
		border-radius: var(--radius-full);
		background: var(--bg-root);
		border: 1px solid var(--border-stream);
		text-transform: capitalize;
	}

	.quote-date {
		color: var(--text-tertiary, var(--text-secondary));
	}

	.remove-btn {
		position: absolute;
		top: 0.75rem;
		right: 0.75rem;
		display: flex;
		align-items: center;
		justify-content: center;
		width: 30px;
		height: 30px;
		border-radius: var(--radius-md);
		border: 1px solid transparent;
		background: transparent;
		color: var(--text-secondary);
		cursor: pointer;
	}

	.remove-btn:hover:not(:disabled) {
		color: var(--color-danger, #f87171);
		border-color: var(--border-stream);
	}

	.remove-btn:disabled {
		opacity: 0.5;
		cursor: default;
	}
</style>
