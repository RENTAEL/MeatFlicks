<script lang="ts">
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { isUser2 } from '../user2';

	const user = $derived(page.data.user ?? null);
	const isCatalog = $derived(
		['/', '/browse', '/movies', '/tv', '/afrikaans', '/search'].some(
			(p) => page.url.pathname === p || page.url.pathname.startsWith(p + '/')
		) ||
			page.url.pathname.startsWith('/movie/') ||
			page.url.pathname.startsWith('/tv/')
	);
	const enabled = $derived(isUser2(user as any) && isCatalog);

	let spinning = $state(false);

	const FALLBACK_IDS = [
		{ id: 27205, type: 'movie' }, // Inception
		{ id: 155, type: 'movie' }, // The Dark Knight
		{ id: 603, type: 'movie' }, // The Matrix
		{ id: 680, type: 'movie' }, // Pulp Fiction
		{ id: 238, type: 'movie' }, // The Godfather
		{ id: 1399, type: 'tv' }, // Game of Thrones
		{ id: 1396, type: 'tv' }, // Breaking Bad
		{ id: 66732, type: 'tv' }, // Stranger Things
		{ id: 82856, type: 'tv' }, // The Mandalorian
		{ id: 1429, type: 'tv' } // Attack on Titan
	];

	async function surprise() {
		if (spinning) return;
		spinning = true;
		try {
			// Try catalog random if it exists
			try {
				const res = await fetch('/api/catalog/random');
				if (res.ok) {
					const data = await res.json();
					const item = data?.item ?? data;
					if (item?.tmdbId || item?.id) {
						const id = item.tmdbId ?? item.id;
						const type = item.mediaType ?? item.media_type ?? 'movie';
						await goto(`/${type === 'tv' ? 'tv' : 'movie'}/${id}`);
						return;
					}
				}
			} catch {}
			// Fallback: random from curated pool
			const pick = FALLBACK_IDS[Math.floor(Math.random() * FALLBACK_IDS.length)];
			await goto(`/${pick.type}/${pick.id}`);
		} finally {
			setTimeout(() => (spinning = false), 800);
		}
	}
</script>

{#if enabled}
	<button class="surprise-btn" class:spin={spinning} onclick={surprise} aria-label="Surprise me">
		<span class="dice" aria-hidden="true">🎲</span> Surprise!
	</button>
{/if}

<style>
	.surprise-btn {
		position: fixed;
		right: 18px;
		bottom: 88px;
		z-index: 40;
		display: inline-flex;
		align-items: center;
		gap: 0.45rem;
		padding: 0.7rem 1.05rem;
		border-radius: 9999px;
		background: linear-gradient(135deg, #a855f7, #06b6d4);
		color: white;
		font-weight: 700;
		font-size: 0.9rem;
		border: none;
		box-shadow: 0 6px 20px rgba(168, 85, 247, 0.35);
		cursor: pointer;
		transition:
			transform 0.15s,
			box-shadow 0.15s;
	}
	.surprise-btn:hover {
		transform: translateY(-1px) scale(1.02);
		box-shadow: 0 10px 28px rgba(168, 85, 247, 0.45);
	}
	.surprise-btn:active {
		transform: scale(0.98);
	}
	.dice {
		display: inline-block;
		transition: transform 0.5s;
	}
	.spin .dice {
		animation: roll 0.7s ease;
	}
	@keyframes roll {
		0% {
			transform: rotate(0deg) scale(1);
		}
		50% {
			transform: rotate(180deg) scale(1.2);
		}
		100% {
			transform: rotate(360deg) scale(1);
		}
	}
	@media (max-width: 640px) {
		.surprise-btn {
			right: 12px;
			bottom: 76px;
			padding: 0.55rem 0.9rem;
			font-size: 0.85rem;
		}
	}
</style>
