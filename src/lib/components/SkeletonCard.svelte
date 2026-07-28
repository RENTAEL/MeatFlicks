<script lang="ts">
	let { width = '100%', aspectRatio = '2/3' }: { width?: string; aspectRatio?: string } = $props();
</script>

<div class="skeleton-card" style="width: {width}">
	<div class="skeleton-poster" style="aspect-ratio: {aspectRatio}"></div>
	<div class="skeleton-body">
		<div class="skeleton-line skeleton-title"></div>
		<div class="skeleton-line skeleton-meta"></div>
	</div>
</div>

<style>
	.skeleton-card {
		background: rgba(30, 27, 75, 0.4);
		border: 1px solid rgba(129, 140, 248, 0.08);
		border-radius: 12px;
		overflow: hidden;
	}

	.skeleton-poster {
		background: linear-gradient(
			110deg,
			rgba(129, 140, 248, 0.05) 30%,
			rgba(129, 140, 248, 0.1) 50%,
			rgba(129, 140, 248, 0.05) 70%
		);
		background-size: 200% 100%;
		animation: shimmer 1.5s infinite;
	}

	.skeleton-body {
		padding: 12px;
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.skeleton-line {
		height: 14px;
		border-radius: 6px;
		background: linear-gradient(
			110deg,
			rgba(129, 140, 248, 0.05) 30%,
			rgba(129, 140, 248, 0.1) 50%,
			rgba(129, 140, 248, 0.05) 70%
		);
		background-size: 200% 100%;
		animation: shimmer 1.5s infinite;
	}

	.skeleton-title {
		width: 80%;
		height: 16px;
	}

	.skeleton-meta {
		width: 50%;
		height: 12px;
	}

	@keyframes shimmer {
		0% { background-position: 200% 0; }
		100% { background-position: -200% 0; }
	}
</style>
