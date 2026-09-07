<script lang="ts">
	import { SUPPORT_URL, SUPPORT_LABEL } from '$lib/config/support';

	let { class: className = '' }: { class?: string } = $props();
</script>

<footer class="footer {className}">
	<div class="container footer-inner">
		<div class="footer-brand">
			<a href="/" class="footer-logo">▶ Streamium</a>
			<p class="footer-tagline">Premium streaming, no compromises.</p>
		</div>

		<div class="footer-creator">
			<span class="creator-emoji">🛠️</span>
			<span>
				Crafted with questionable sleep habits by
				<span class="creator-name">the developer</span>
			</span>
		</div>

		<a class="footer-coffee" href={SUPPORT_URL} target="_blank" rel="noopener noreferrer">
			<span aria-hidden="true">☕</span> {SUPPORT_LABEL}
		</a>

		<div class="footer-links">
			<a href="/movies">Movies</a>
			<a href="/tv">TV Series</a>
			<a href="/afrikaans">Afrikaans</a>
			<a href="/disclaimer#about">About</a>
			<a href="/disclaimer#contact">Contact</a>
			<a href="/disclaimer#dmca">DMCA</a>
		</div>

		<div class="footer-bottom">
			<span>&copy; {new Date().getFullYear()} Streamium. All rights reserved.</span>
		</div>
	</div>
</footer>

<style>
	.footer {
		padding: 3rem 0 1.5rem;
		border-top: 1px solid var(--border-stream);
		margin-top: 4rem;
	}

	.footer-inner {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.75rem;
		text-align: center;
	}

	.footer-brand {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.25rem;
	}

	.footer-logo {
		font-weight: var(--font-weight-extrabold);
		font-size: 1.1rem;
		background: var(--gradient-brand-horizontal);
		-webkit-background-clip: text;
		-webkit-text-fill-color: transparent;
		background-clip: text;
	}

	.footer-tagline {
		color: var(--text-tertiary);
		font-size: 0.85rem;
	}

	.footer-creator {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.5rem;
		padding: 0.25rem 0;
		font-size: 0.8rem;
		color: var(--text-tertiary);
	}

	.footer-coffee {
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
		padding: 0.3rem 0.85rem;
		border-radius: var(--radius-full);
		border: 1px solid transparent;
		color: var(--text-tertiary);
		font-size: 0.8rem;
		text-decoration: none;
		transition:
			color var(--transition-fast),
			border-color var(--transition-fast),
			box-shadow var(--transition-fast);
	}

	.footer-coffee:hover {
		color: #e7c663;
		border-color: rgba(142, 29, 46, 0.4);
		box-shadow: 0 0 14px rgba(142, 29, 46, 0.22);
	}

	.footer-coffee:focus-visible {
		outline: 2px solid rgba(212, 175, 55, 0.9);
		outline-offset: 2px;
	}

	.creator-name {
		color: var(--accent);
		font-weight: var(--font-weight-semibold);
		transition: all var(--transition-fast);
	}

	.creator-name:hover {
		background: var(--gradient-brand-horizontal);
		-webkit-background-clip: text;
		-webkit-text-fill-color: transparent;
		background-clip: text;
	}

	.footer-links {
		display: flex;
		gap: 2rem;
	}

	.footer-links a {
		color: var(--text-secondary);
		font-size: 0.9rem;
		transition: color var(--transition-fast);
	}

	.footer-links a:hover {
		color: var(--text-primary);
	}

	.footer-bottom {
		color: var(--text-tertiary);
		font-size: 0.8rem;
	}
</style>
