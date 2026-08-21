<script lang="ts">
	import { page } from '$app/state';
	import { goto } from '$app/navigation';

	const isCatalog = $derived(
		['/', '/browse', '/movies', '/tv', '/afrikaans', '/search'].some(
			(p) => page.url.pathname === p || page.url.pathname.startsWith(p + '/')
		) ||
			page.url.pathname.startsWith('/movie/') ||
			page.url.pathname.startsWith('/tv/')
	);
	const enabled = $derived(isCatalog);

	let spinning = $state(false);
	let message = $state('');

	// Movies only — curated pool for instant fallback (no TV)
	const MOVIE_POOL = [
		27205, // Inception
		155, // The Dark Knight
		603, // The Matrix
		680, // Pulp Fiction
		238, // The Godfather
		496243, // Parasite
		389, // 12 Angry Men
		13, // Forrest Gump
		278, // The Shawshank Redemption
		550, // Fight Club
		120, // LOTR Fellowship
		122, // LOTR Return
		429, // Good Will Hunting
		1891 // The Empire Strikes Back
	];

	let cachedMovies: string[] | null = null;

	function pickFromDom(): string | null {
		// Fast path: pick from already-rendered movie cards (no fetch)
		const links = Array.from(document.querySelectorAll<HTMLAnchorElement>('a[href^="/movie/"]'));
		// Filter to only movie links with valid IDs and exclude duplicates
		const hrefs = [
			...new Set(links.map((a) => a.getAttribute('href')).filter(Boolean) as string[])
		];
		if (hrefs.length === 0) return null;
		return hrefs[Math.floor(Math.random() * hrefs.length)];
	}

	async function fetchRandomMovies(): Promise<string[] | null> {
		if (cachedMovies) return cachedMovies;
		try {
			// Lightweight: fetch a small set of popular movies, cache it
			const res = await fetch('/api/media/top-rated?limit=20', {
				headers: { accept: 'application/json' }
			});
			if (res.ok) {
				const data = await res.json();
				const list = Array.isArray(data) ? data : (data?.results ?? data?.items ?? []);
				const movieHrefs = list
					.filter((m: any) => (m.mediaType ?? m.media_type ?? 'movie') === 'movie')
					.map((m: any) => `/movie/${m.tmdbId ?? m.id}`)
					.filter(Boolean);
				if (movieHrefs.length > 0) {
					cachedMovies = movieHrefs;
					return movieHrefs;
				}
			}
		} catch {}
		return null;
	}

	async function surprise() {
		if (spinning) return;
		spinning = true;
		message = '';
		try {
			// 1. Instant: pick from already-loaded movie cards on the page (fastest, no fetch)
			const domPick = pickFromDom();
			if (domPick) {
				await goto(domPick);
				return;
			}

			// 2. Fast lightweight fetch with cache — movies only
			const cached = await fetchRandomMovies();
			if (cached && cached.length > 0) {
				const href = cached[Math.floor(Math.random() * cached.length)];
				await goto(href);
				return;
			}

			// 3. Instant fallback: curated movies-only pool (no TV)
			const id = MOVIE_POOL[Math.floor(Math.random() * MOVIE_POOL.length)];
			await goto(`/movie/${id}`);
		} catch {
			message = 'No movies available right now — try again!';
			setTimeout(() => (message = ''), 2500);
		} finally {
			// Animation is 0.7s; reset right after so repeat clicks feel instant
			setTimeout(() => (spinning = false), 700);
		}
	}
</script>

{#if enabled}
	<button class="surprise-btn" class:spin={spinning} onclick={surprise} aria-label="Surprise me">
		<span class="dice" aria-hidden="true">🎲</span> Surprise!
	</button>
	{#if message}
		<div class="surprise-msg" role="status">{message}</div>
	{/if}
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
		will-change: transform; /* compositor-only hover/press — no jank */
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
		line-height: 1;
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
	.surprise-msg {
		position: fixed;
		right: 18px;
		bottom: 132px;
		z-index: 40;
		padding: 0.6rem 0.9rem;
		border-radius: 12px;
		background: rgba(20, 20, 30, 0.92);
		border: 1px solid rgba(255, 255, 255, 0.08);
		color: var(--text-primary);
		font-size: 0.85rem;
		box-shadow: 0 8px 24px rgba(0, 0, 0, 0.35);
	}

	@media (max-width: 640px) {
		.surprise-btn {
			right: 12px;
			bottom: 76px;
			padding: 0.55rem 0.9rem;
			font-size: 0.85rem;
		}
		.surprise-msg {
			right: 12px;
			bottom: 118px;
		}
	}
</style>
