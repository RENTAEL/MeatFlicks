<script lang="ts">
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';

	$: is404 = $page.status === 404;
	$: is500 = $page.status === 500;

	const gavin404s = [
		"This page is missing. Gavin probably deleted it by accident. Sorry.",
		"404 — Gavin forgot to ship this page. Classic.",
		"Nothing here. Gavin swears it was working on his machine. 🤷",
		"Page not found. Gavin's bad. He'll fix it... eventually.",
		"404. Gavin pushed to prod without testing this route. Rookie move.",
	];

	const gavin500s = [
		"Something broke. Gavin is probably staring at the logs right now.",
		"500 — Gavin's code went on an unplanned coffee break. ☕",
		"Server error. Gavin says 'it works locally' — famous last words.",
	];

	$: message = is404
		? gavin404s[Math.floor(Math.random() * gavin404s.length)]
		: is500
		? gavin500s[Math.floor(Math.random() * gavin500s.length)]
		: "Something went wrong. Gavin's working on it... probably.";
</script>

<svelte:head>
	<title>{is404 ? '404 — Not Found' : 'Error'} — Streamium</title>
</svelte:head>

<div class="error-page">
	<div class="error-card glass scale-in">
		<div class="error-code-wrapper">
			<span class="error-code">{is404 ? '404' : is500 ? '500' : 'Oops'}</span>
		</div>

		<div class="gavin-face">
			{#if is404}
				<span class="face-emoji">🫥</span>
			{:else if is500}
				<span class="face-emoji">😵‍💫</span>
			{:else}
				<span class="face-emoji">😬</span>
			{/if}
		</div>

		<p class="error-message">{message}</p>

		<div class="error-actions">
			<button class="btn btn-primary" onclick={() => goto('/')}>
				← Back to Home
			</button>
			<button class="btn btn-secondary" onclick={() => window.location.reload()}>
				Try Again
			</button>
		</div>

		<p class="error-footer">
			— Gavin,{' '}
			{#if is404}
				Master of Broken Links
			{:else}
				Senior Debugger (currently debugging)
			{/if}
		</p>
	</div>
</div>

<style>
	.error-page {
		min-height: calc(100vh - var(--header-height));
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 2rem 1rem;
	}

	.error-card {
		max-width: 480px;
		width: 100%;
		padding: 3rem 2rem;
		border-radius: var(--radius-xl);
		text-align: center;
	}

	.error-code-wrapper {
		margin-bottom: 1rem;
	}

	.error-code {
		font-size: 6rem;
		font-weight: var(--font-weight-black);
		line-height: 1;
		background: var(--gradient-brand-horizontal);
		-webkit-background-clip: text;
		-webkit-text-fill-color: transparent;
		background-clip: text;
		letter-spacing: -0.03em;
	}

	.gavin-face {
		margin-bottom: 1.5rem;
	}

	.face-emoji {
		font-size: 4rem;
		display: inline-block;
		animation: bounce 2s infinite;
	}

	@keyframes bounce {
		0%, 100% { transform: translateY(0); }
		50% { transform: translateY(-10px); }
	}

	.error-message {
		font-size: 1.05rem;
		color: var(--text-primary);
		line-height: 1.6;
		margin-bottom: 2rem;
	}

	.error-actions {
		display: flex;
		gap: 0.75rem;
		justify-content: center;
		flex-wrap: wrap;
		margin-bottom: 1.5rem;
	}

	.error-footer {
		font-size: 0.8rem;
		color: var(--text-tertiary);
		font-style: italic;
	}

	.error-footer::before {
		content: '';
		display: block;
		width: 40px;
		height: 1px;
		background: var(--border-stream);
		margin: 0 auto 0.75rem;
	}
</style>
