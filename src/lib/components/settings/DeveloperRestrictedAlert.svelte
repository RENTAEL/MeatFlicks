<script lang="ts">
	let { title = 'ACCESS DENIED' }: { title?: string } = $props();
</script>

<section class="dev-restricted glass" aria-label="Developer restricted area">
	<div class="dr-badge" aria-hidden="true">🚫</div>
	<h2 class="dr-title">{title}</h2>
	<p class="dr-line">Nice try. The developer has restricted this area.</p>
	<p class="dr-line">
		This incident has been logged, and honestly… we're a little impressed you got this far. 🕵️
	</p>
	<p class="dr-sub">
		If you're the developer, sign in with the admin account — otherwise, head back and enjoy the
		movies.
	</p>
	<a class="dr-btn" href="/">← Back to the good stuff</a>
</section>

<style>
	.dev-restricted {
		max-width: 460px;
		margin: 3rem auto;
		padding: 2.5rem 2rem;
		border-radius: var(--radius-xl);
		border: 1px solid rgba(239, 68, 68, 0.35);
		text-align: center;
		background: var(--bg-card);
	}

	.dr-badge {
		font-size: 3rem;
		line-height: 1;
		margin-bottom: 0.75rem;
	}

	.dr-title {
		font-size: 1.5rem;
		font-weight: var(--font-weight-extrabold, 800);
		letter-spacing: 0.08em;
		text-transform: uppercase;
		background: linear-gradient(135deg, #f87171, #fbbf24);
		-webkit-background-clip: text;
		background-clip: text;
		color: transparent;
		margin: 0 0 0.75rem;
	}

	.dr-line {
		margin: 0 0 0.5rem;
		color: var(--text-primary);
		font-size: 1rem;
		line-height: 1.5;
	}

	.dr-sub {
		margin: 1rem 0 1.25rem;
		color: var(--text-secondary);
		font-size: 0.85rem;
		line-height: 1.5;
	}

	.dr-btn {
		display: inline-block;
		padding: 0.6rem 1.4rem;
		border-radius: var(--radius-full);
		background: var(--gradient-brand);
		color: #fff;
		font-size: 0.9rem;
		font-weight: var(--font-weight-semibold, 600);
		text-decoration: none;
		transition: all var(--transition-base);
	}

	.dr-btn:hover {
		transform: translateY(-1px);
		box-shadow: 0 4px 20px var(--accent-glow);
	}
</style>
