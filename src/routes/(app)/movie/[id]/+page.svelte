<script lang="ts">
	import { onMount } from 'svelte';
	import type { PageData } from './$types';

	let MediaDetailsPage = $state<any>(null);
	let loadError = $state<string | null>(null);
	let isMounted = $state(false);
	let timedOut = $state(false);
	let { data }: { data: PageData } = $props();

	onMount(async () => {
		isMounted = true;
		const timeout = setTimeout(() => {
			if (!MediaDetailsPage) timedOut = true;
		}, 10000);
		try {
			const module = await import('$lib/components/media/MediaDetailsPage.svelte');
			clearTimeout(timeout);
			MediaDetailsPage = module.default;
		} catch (e: any) {
			clearTimeout(timeout);
			console.error('[movie] Failed to load MediaDetailsPage:', e);
			loadError = e?.message ?? 'Failed to load page component';
		}
	});
</script>

{#if timedOut}
	<div class="error-page">
		<h2>Request timed out</h2>
		<p>The page took too long to load. Please try again.</p>
		<a href="/" class="btn">Go Home</a>
	</div>
{:else if loadError}
	<div class="error-page">
		<h2>Something went wrong</h2>
		<p>{loadError}</p>
		<a href="/" class="btn">Go Home</a>
	</div>
{:else if !data.movie && isMounted}
	<div class="error-page">
		<h2>Movie not found</h2>
		<a href="/" class="btn">Go Home</a>
	</div>
{:else if !isMounted}
	<div class="loading-page">
		<div class="spinner"></div>
		<p>Loading...</p>
	</div>
{:else if MediaDetailsPage}
	<MediaDetailsPage data={data} />
{/if}

<style>
	.loading-page,
	.error-page {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		min-height: 60vh;
		color: white;
		gap: 1rem;
	}

	.spinner {
		width: 40px;
		height: 40px;
		border: 3px solid rgba(255, 255, 255, 0.1);
		border-top-color: #7c3aed;
		border-radius: 50%;
		animation: spin 0.8s linear infinite;
	}

	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}

	.btn {
		padding: 0.75rem 1.5rem;
		background: linear-gradient(135deg, #7c3aed, #a855f7);
		color: white;
		border-radius: 8px;
		text-decoration: none;
		font-weight: 600;
	}
</style>
