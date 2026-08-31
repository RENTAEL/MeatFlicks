<script lang="ts">
	import SuneRoseLogo from './SuneRoseLogo.svelte';
	let { progress = 0 }: { progress?: number } = $props();
</script>

<div class="sune-loading" role="status" aria-live="polite" aria-label="Loading Rose Court">
	<div class="sune-loading-glow" aria-hidden="true"></div>
	<div class="sune-loading-card">
		<div class="sune-loading-logo">
			<SuneRoseLogo size="lg" />
		</div>
		<p class="sune-loading-title">Rose Court</p>
		<p class="sune-loading-sub">Preparing your private collection…</p>
		<div class="sune-loading-bar" aria-hidden="true">
			<div class="sune-loading-fill" style="width: {Math.min(100, Math.max(0, progress))}%"></div>
		</div>
	</div>
</div>

<style>
	.sune-loading {
		position: fixed;
		inset: 0;
		z-index: 9999;
		display: flex;
		align-items: center;
		justify-content: center;
		background: #0a0a0f;
		overflow: hidden;
	}

	.sune-loading-glow {
		position: absolute;
		inset: -20%;
		background:
			radial-gradient(ellipse 60% 40% at 50% 30%, rgba(142, 29, 46, 0.18) 0%, transparent 60%),
			radial-gradient(ellipse 50% 30% at 80% 80%, rgba(212, 175, 55, 0.12) 0%, transparent 60%);
		filter: blur(30px);
		animation: suneLoadingGlow 3s ease-in-out infinite alternate;
	}

	.sune-loading-card {
		position: relative;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.7rem;
		padding: 2rem 2.5rem;
		border-radius: 16px;
		background: rgba(20, 13, 18, 0.9);
		border: 1px solid rgba(212, 175, 55, 0.18);
		box-shadow:
			0 8px 32px rgba(0, 0, 0, 0.5),
			0 0 24px rgba(212, 175, 55, 0.12);
		backdrop-filter: blur(12px);
	}

	.sune-loading-logo {
		animation: suneLoadingPulse 2.2s ease-in-out infinite alternate;
	}

	.sune-loading-title {
		margin: 0;
		font-family: 'Playfair Display', Georgia, serif;
		font-size: 1.4rem;
		font-weight: 700;
		letter-spacing: 0.02em;
		color: #f6efe6;
		text-shadow: 0 0 12px rgba(212, 175, 55, 0.22);
	}

	.sune-loading-sub {
		margin: 0;
		font-size: 0.85rem;
		color: #c9b3bc;
	}

	.sune-loading-bar {
		width: 180px;
		height: 3px;
		border-radius: 999px;
		background: rgba(212, 175, 55, 0.14);
		overflow: hidden;
		margin-top: 0.4rem;
	}

	.sune-loading-fill {
		height: 100%;
		background: linear-gradient(90deg, #8e1d2e, #d4af37);
		border-radius: 999px;
		transition: width 0.4s ease;
	}

	@keyframes suneLoadingPulse {
		0% {
			transform: scale(1);
			filter: drop-shadow(0 0 6px rgba(212, 175, 55, 0.28));
		}
		100% {
			transform: scale(1.03);
			filter: drop-shadow(0 0 14px rgba(212, 175, 55, 0.45));
		}
	}

	@keyframes suneLoadingGlow {
		0% {
			opacity: 0.7;
			transform: scale(1);
		}
		100% {
			opacity: 1;
			transform: scale(1.05);
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.sune-loading-logo,
		.sune-loading-glow {
			animation: none !important;
		}
	}
</style>
