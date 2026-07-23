<script lang="ts">
	import { onMount } from 'svelte';
	import type { PageData } from './$types';

	let MediaDetailsPage = $state<any>(null);
	let loadError = $state<string | null>(null);
	let isMounted = $state(false);
	let { data }: { data: PageData } = $props();

	onMount(async () => {
		isMounted = true;
		try {
			const module = await import('$lib/components/media/MediaDetailsPage.svelte');
			MediaDetailsPage = module.default;
		} catch (e: any) {
			console.error('[movie] Failed to load MediaDetailsPage:', e);
			loadError = e?.message ?? 'Failed to load page component';
		}
	});
</script>

{#if !isMounted}
	<div class="loading-page">
		<div class="spinner"></div>
		<p>Loading...</p>
	</div>
{:else if loadError}
	<div class="error-page">
		<h2>Something went wrong</h2>
		<p>{loadError}</p>
		<a href="/" class="btn">Go Home</a>
	</div>
{:else if !data.movie}
	<div class="error-page">
		<h2>Movie not found</h2>
		<a href="/" class="btn">Go Home</a>
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
