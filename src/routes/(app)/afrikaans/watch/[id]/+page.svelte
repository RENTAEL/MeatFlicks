<script lang="ts">
	import AfrikaansPlayer from '$lib/components/afrikaans/AfrikaansPlayer.svelte';
	import { page } from '$app/state';

	const details = page.data.details;
	const reachability = page.data.reachability ?? {};
</script>

<svelte:head>
	<title>{details.title} · Afrikaans · Streamium</title>
	<meta name="description" content="Kyk {details.title} op Streamium se Afrikaans-speler." />
</svelte:head>

<div class="af-watch">
	<AfrikaansPlayer {details} {reachability} />
	<a class="af-watch-back" href="/afrikaans">← Terug na Afrikaans / Back to Afrikaans</a>
</div>

<style>
	.af-watch {
		min-height: 100vh;
		padding-top: calc(env(safe-area-inset-top, 0px) + 1rem);
		padding-bottom: 3rem;
		background: #09090b;
	}
	.af-watch-back {
		display: inline-block;
		margin: 1rem 1.25rem 0;
		font-size: 0.85rem;
		color: var(--afrikaans-accent, #f5a623);
		text-decoration: none;
	}
	.af-watch-back:hover {
		text-decoration: underline;
	}
</style>
