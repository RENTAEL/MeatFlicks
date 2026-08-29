<script lang="ts">
	// Sune — dark regal "Rose Court" hero banner.
	// Scoped to Sune's profile page; the rose image is the visual anchor with a
	// dark gradient overlay so text stays readable.
	let {
		username,
		tagline = 'Where shadows bloom',
		sub = 'A court of thorns — and light, unfolding quietly in the dark.'
	}: { username: string; tagline?: string; sub?: string } = $props();
</script>

<div class="sune-banner">
	<div class="sune-banner-overlay" aria-hidden="true"></div>
	<div class="sune-banner-inner">
		<p class="sune-eyebrow">✦ The Rose Court ✦</p>
		<h1 class="sune-title">{tagline}</h1>
		<p class="sune-sub">{sub}</p>
		<p class="sune-greeting">Welcome, {username}. The throne room is yours tonight.</p>
	</div>
	<div class="sune-motif" aria-hidden="true">❦</div>
</div>

<style>
	.sune-banner {
		position: relative;
		overflow: hidden;
		margin-bottom: 1.5rem;
		padding: 2.25rem 1.5rem 2rem;
		border-radius: var(--radius-lg);
		border: 1px solid rgba(212, 175, 55, 0.28);
		box-shadow:
			0 10px 36px rgba(0, 0, 0, 0.6),
			0 0 30px rgba(139, 21, 42, 0.18);
	}

	.sune-banner-overlay {
		position: absolute;
		inset: 0;
		background-image:
			linear-gradient(180deg, rgba(8, 6, 9, 0.42) 0%, rgba(8, 6, 9, 0.74) 58%, rgba(8, 6, 9, 0.94) 100%),
			linear-gradient(115deg, rgba(94, 14, 30, 0.55) 0%, rgba(8, 6, 9, 0.25) 55%, rgba(8, 6, 9, 0.1) 100%),
			radial-gradient(ellipse 80% 60% at 82% 0%, rgba(212, 175, 55, 0.14) 0%, transparent 60%),
			url('/personal/sune-roses.jpg');
		background-size: cover;
		background-position: center 38%;
	}

	.sune-banner-inner {
		position: relative;
		z-index: 1;
		max-width: 620px;
	}

	.sune-eyebrow {
		margin: 0 0 0.5rem;
		font-size: 0.72rem;
		letter-spacing: 0.32em;
		text-transform: uppercase;
		color: #e7c663;
		font-weight: 600;
	}

	.sune-title {
		margin: 0;
		font-family: 'Playfair Display', 'Cormorant Garamond', Georgia, 'Times New Roman', serif;
		font-weight: 700;
		font-size: clamp(1.9rem, 6vw, 3rem);
		line-height: 1.05;
		letter-spacing: 0.01em;
		color: #f6efe6;
		text-shadow:
			0 2px 18px rgba(0, 0, 0, 0.6),
			0 0 26px rgba(0, 0, 0, 0.35);
	}

	.sune-sub {
		margin: 0.6rem 0 0;
		font-family: 'Cormorant Garamond', Georgia, serif;
		font-style: italic;
		font-size: 1.1rem;
		color: #d9c4b6;
		max-width: 46ch;
	}

	.sune-greeting {
		margin: 1rem 0 0;
		font-size: 0.85rem;
		letter-spacing: 0.02em;
		color: rgba(231, 198, 99, 0.85);
	}

	.sune-motif {
		position: absolute;
		top: 50%;
		right: 1.4rem;
		transform: translateY(-50%);
		font-size: 4.5rem;
		color: #d4af37;
		opacity: 0.1;
		pointer-events: none;
		z-index: 1;
	}

	@media (max-width: 600px) {
		.sune-banner {
			padding: 1.75rem 1.15rem 1.5rem;
		}
		.sune-motif {
			font-size: 3.4rem;
			right: 0.8rem;
		}
	}
</style>
