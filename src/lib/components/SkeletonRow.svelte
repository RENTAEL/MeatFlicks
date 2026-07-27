<script lang="ts">
	let { count = 6 }: { count?: number } = $props();
</script>

<div class="skeleton-row">
	<div class="skeleton-header"></div>
	<div class="skeleton-cards">
		{#each Array(count) as _}
			<div class="skeleton-card">
				<div class="skeleton-poster"></div>
				<div class="skeleton-line short"></div>
				<div class="skeleton-line shorter"></div>
			</div>
		{/each}
	</div>
</div>

<style>
	.skeleton-row { padding: 0 16px; margin-bottom: 24px; }
	.skeleton-header { width: 140px; height: 20px; border-radius: 6px; background: #18181b; margin-bottom: 14px; animation: pulse 1.5s infinite; }
	.skeleton-cards { display: flex; gap: 10px; }
	.skeleton-card { flex-shrink: 0; width: 140px; }
	.skeleton-poster { width: 100%; aspect-ratio: 2/3; border-radius: 10px; background: #18181b; animation: pulse 1.5s infinite; }
	.skeleton-line { height: 12px; border-radius: 6px; background: #18181b; margin-top: 8px; animation: pulse 1.5s infinite; }
	.skeleton-line.short { width: 80%; }
	.skeleton-line.shorter { width: 50%; }
	@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
	@media (min-width: 768px) { .skeleton-card { width: 180px; } }
</style>
