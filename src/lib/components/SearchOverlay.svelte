<script lang="ts">
	import { searchOpen } from '$lib/stores/search';
	import { goto } from '$app/navigation';
	import { fade, fly } from 'svelte/transition';

	let query = $state('');
	let results = $state<any[]>([]);
	let isLoading = $state(false);
	let debounceTimer: ReturnType<typeof setTimeout> | undefined;
	let inputEl: HTMLInputElement | undefined;

	async function search(q: string) {
		if (q.length < 2) { results = []; return; }
		isLoading = true;
		try {
			const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
			const data = await res.json();
			results = data.items?.slice(0, 20) || data.results?.slice(0, 20) || [];
		} catch { results = []; }
		finally { isLoading = false; }
	}

	function onInput() {
		clearTimeout(debounceTimer);
		debounceTimer = setTimeout(() => search(query), 250);
	}

	function selectItem(item: any) {
		const type = item.media_type === 'tv' ? 'tv' : 'movie';
		searchOpen.set(false);
		query = '';
		results = [];
		goto(`/${type}/${item.id}`);
	}

	function close() {
		searchOpen.set(false);
		query = '';
		results = [];
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') close();
	}
</script>

<svelte:window onkeydown={handleKeydown} />

{#if $searchOpen}
	<div class="search-backdrop" onclick={close} transition:fade={{ duration: 150 }}></div>

	<div class="search-panel" transition:fly={{ y: -20, duration: 250 }}>
		<div class="search-input-row">
			<button onclick={close} class="search-back-btn" aria-label="Go back">
				<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>
			</button>
			<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="search-input-icon">
				<circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
			</svg>
			<input
				bind:this={inputEl}
				type="search"
				placeholder="Search movies & TV shows..."
				class="search-input"
				bind:value={query}
				oninput={onInput}
				autocomplete="off"
				spellcheck="false"
			/>
			<button onclick={close} class="search-cancel">Cancel</button>
		</div>

		<div class="search-results">
			{#if isLoading}
				<div class="search-loading"><div class="spinner"></div></div>
			{:else if query.length > 0 && results.length === 0}
				<div class="search-empty">
					<p class="search-empty-title">No results found</p>
					<p class="search-empty-sub">Try a different search term</p>
				</div>
			{:else if query.length < 2}
				<div class="search-prompt"><p class="search-prompt-text">Start typing to search</p></div>
			{:else}
				{#each results as item (item.id)}
					<button onclick={() => selectItem(item)} class="search-result-item">
						<div class="search-result-poster">
							{#if item.poster_path}
								<img src="https://image.tmdb.org/t/p/w92{item.poster_path}" alt={item.title || item.name} loading="lazy" class="search-result-img" />
							{:else}
								<div class="search-result-placeholder"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="size-5"><rect x="2" y="2" width="20" height="20" rx="2.18"/><line x1="7" y1="2" x2="7" y2="22"/><line x1="17" y1="2" x2="17" y2="22"/></svg></div>
							{/if}
						</div>
						<div class="search-result-info">
							<p class="search-result-title">{item.title || item.name}</p>
							<div class="search-result-meta">
								<span class="search-result-type">{item.media_type === 'tv' ? 'TV Show' : 'Movie'}</span>
								{#if item.release_date || item.first_air_date}
									<span class="search-result-year">{(item.release_date || item.first_air_date).split('-')[0]}</span>
								{/if}
								{#if item.vote_average > 0}
									<span class="search-result-rating">★ {item.vote_average.toFixed(1)}</span>
								{/if}
							</div>
						</div>
					</button>
				{/each}
			{/if}
		</div>
	</div>
{/if}

<style>
	.search-backdrop {
		position: fixed;
		inset: 0;
		z-index: 90;
		background: rgba(0, 0, 0, 0.7);
		backdrop-filter: blur(12px);
	}

	.search-panel {
		position: fixed;
		inset: 0;
		z-index: 91;
		background: var(--bg-root);
		display: flex;
		flex-direction: column;
	}

	@media (min-width: 768px) {
		.search-panel {
			inset: 10vh 10vw;
			border-radius: var(--radius-xl);
			border: 1px solid var(--glass-border);
			box-shadow: var(--shadow-lg);
			background: var(--bg-surface);
		}
	}

	.search-input-row {
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 16px;
		border-bottom: 1px solid var(--border-stream);
	}

	.search-input-icon {
		width: 20px;
		height: 20px;
		color: var(--text-tertiary);
		flex-shrink: 0;
	}

	.search-input {
		flex: 1;
		background: none;
		border: none;
		color: var(--text-primary);
		font-size: 17px;
		font-weight: 400;
		outline: none;
		font-family: inherit;
	}

	.search-input::placeholder {
		color: var(--text-tertiary);
	}

	.search-cancel {
		background: none;
		border: none;
		color: var(--accent-stream);
		font-size: 15px;
		font-weight: 600;
		cursor: pointer;
		padding: 8px 4px;
	}

	.search-back-btn {
		width: 44px; height: 44px; display: flex; align-items: center; justify-content: center;
		background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.1);
		color: var(--text-primary); cursor: pointer; border-radius: var(--radius-sm);
		flex-shrink: 0; -webkit-tap-highlight-color: transparent;
	}

	.search-back-btn:active {
		background: rgba(255,255,255,0.15);
	}

	.search-back-btn svg {
		width: 20px; height: 20px; stroke: var(--text-primary);
	}

	@media (max-width: 768px) {
		.search-cancel {
			display: none;
		}
	}

	.search-results {
		flex: 1;
		overflow-y: auto;
		-webkit-overflow-scrolling: touch;
	}

	.search-loading {
		display: flex;
		justify-content: center;
		padding: 40px;
	}

	.spinner {
		width: 28px;
		height: 28px;
		border: 2px solid var(--border-stream);
		border-top-color: var(--accent-stream);
		border-radius: 50%;
		animation: spin 0.6s linear infinite;
	}

	@keyframes spin {
		to { transform: rotate(360deg); }
	}

	.search-empty, .search-prompt {
		display: flex;
		flex-direction: column;
		align-items: center;
		padding: 60px 20px;
		text-align: center;
	}

	.search-empty-title {
		color: var(--text-secondary);
		font-weight: 500;
	}

	.search-empty-sub {
		color: var(--text-tertiary);
		font-size: 0.9rem;
		margin-top: 0.25rem;
	}

	.search-prompt-text {
		color: var(--text-tertiary);
	}

	.search-result-item {
		display: flex;
		align-items: center;
		gap: 12px;
		width: 100%;
		padding: 12px 16px;
		background: none;
		border: none;
		cursor: pointer;
		text-align: left;
		transition: background var(--transition-fast);
	}

	.search-result-item:hover {
		background: var(--accent-soft);
	}

	.search-result-poster {
		width: 44px;
		height: 66px;
		border-radius: var(--radius-sm);
		overflow: hidden;
		background: var(--bg-elevated);
		flex-shrink: 0;
	}

	.search-result-img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	.search-result-placeholder {
		width: 100%;
		height: 100%;
		display: flex;
		align-items: center;
		justify-content: center;
		color: var(--text-tertiary);
	}

	.search-result-info {
		flex: 1;
		min-width: 0;
	}

	.search-result-title {
		font-size: 15px;
		font-weight: 500;
		color: var(--text-primary);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.search-result-meta {
		display: flex;
		align-items: center;
		gap: 8px;
		margin-top: 3px;
	}

	.search-result-type, .search-result-year {
		color: var(--text-tertiary);
		font-size: 0.8rem;
	}

	.search-result-rating {
		color: #fbbf24;
		font-size: 0.8rem;
		font-weight: 600;
	}
</style>
