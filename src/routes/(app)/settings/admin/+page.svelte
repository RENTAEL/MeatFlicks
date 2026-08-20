<script lang="ts">
	import { page } from '$app/stores';
	import AdminPanel from '$lib/components/admin/AdminPanel.svelte';
	import DeveloperRestrictedAlert from '$lib/components/settings/DeveloperRestrictedAlert.svelte';

	const { data } = $props();
</script>

<svelte:head>
	<title>Admin — Streamium</title>
</svelte:head>

<div class="admin-page">
	{#if data.isAdmin}
		<div class="admin-page-header">
			<h1>Admin Panel</h1>
			<p>
				Full operations console. Everything here runs server-side and only works for the admin
				account.
			</p>
		</div>
		<AdminPanel />
	{:else if !$page.data?.user}
		<div class="admin-please-login">
			<DeveloperRestrictedAlert title="ACCESS DENIED" />
		</div>
	{:else}
		<DeveloperRestrictedAlert />
	{/if}
</div>

<style>
	.admin-page {
		max-width: 720px;
		margin: 0 auto;
		padding: 2rem 1rem;
	}

	.admin-page-header {
		margin-bottom: 1.5rem;
	}

	.admin-page-header h1 {
		font-size: 1.75rem;
		font-weight: var(--font-weight-extrabold, 800);
		color: var(--text-primary);
		margin: 0 0 0.35rem;
	}

	.admin-page-header p {
		color: var(--text-secondary);
		margin: 0;
		font-size: 0.9rem;
	}

	.admin-please-login {
		padding-top: 2rem;
	}
</style>
