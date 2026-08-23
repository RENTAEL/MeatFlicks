<script lang="ts">
	import AdminPanel from '$lib/components/admin/AdminPanel.svelte';

	let { data }: { data: { username: string } } = $props();
</script>

<svelte:head>
	<title>Admin Console — Streamium</title>
</svelte:head>

<div class="admin-console">
	<header class="admin-header">
		<div class="admin-header-inner">
			<span class="admin-badge" aria-hidden="true">🛠️</span>
			<div class="admin-heading">
				<h1>Admin Console</h1>
				<p>
					Full operations console — signed in as
					<strong>{data.username}</strong>. Everything here runs server-side and only works for the
					admin account.
				</p>
			</div>
			<a class="admin-back" href="/settings"><span aria-hidden="true">←</span> Settings</a>
		</div>
	</header>

	<main class="admin-main">
		<AdminPanel />
	</main>
</div>

<style>
	.admin-console {
		min-height: 100vh;
		/* Layout wrapper already clears the fixed header — own spacing only. */
		padding-top: calc(env(safe-area-inset-top, 0px) + 1.25rem);
		padding-bottom: 4rem;
	}
	.admin-header {
		border-bottom: 1px solid var(--border, rgba(255, 255, 255, 0.08));
		background: color-mix(in srgb, var(--card, #18181b) 55%, transparent);
		backdrop-filter: blur(8px);
	}
	.admin-header-inner {
		max-width: 1100px;
		margin: 0 auto;
		display: flex;
		align-items: center;
		gap: 1rem;
		padding: 1.25rem 1.5rem;
	}
	.admin-badge {
		font-size: 1.6rem;
		line-height: 1;
	}
	.admin-heading {
		flex: 1;
		min-width: 0;
	}
	.admin-heading h1 {
		margin: 0 0 0.2rem;
		font-size: 1.45rem;
		font-weight: var(--font-weight-extrabold, 800);
		color: var(--text-primary);
	}
	.admin-heading p {
		margin: 0;
		font-size: 0.85rem;
		color: var(--text-secondary);
	}
	.admin-back {
		flex-shrink: 0;
		font-size: 0.82rem;
		color: var(--text-secondary);
		text-decoration: none;
		padding: 0.35rem 0.7rem;
		border-radius: 0.5rem;
		border: 1px solid var(--border, rgba(255, 255, 255, 0.12));
	}
	.admin-back:hover {
		color: var(--text-primary);
	}
	.admin-main {
		max-width: 1100px;
		margin: 0 auto;
		padding: 1.75rem 1.5rem 0;
	}

	@media (max-width: 640px) {
		.admin-header-inner,
		.admin-main {
			padding-left: 1rem;
			padding-right: 1rem;
		}
		.admin-back span {
			display: none;
		}
	}
</style>
