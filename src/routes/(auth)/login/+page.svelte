<script lang="ts">
	import { enhance } from '$app/forms';
	import { Button } from '$lib/components/ui/button';

	let { data, form } = $props();
</script>

<svelte:head>
	<title>Sign In — Streamium</title>
</svelte:head>

<div class="auth-page">
	<div class="auth-card glass scale-in">
		<a href="/" class="auth-logo">
			<span class="auth-logo-icon">▶</span>
			<span class="auth-logo-text">Streamium</span>
		</a>

		<h1 class="auth-heading">Welcome back</h1>
		<p class="auth-subtitle">Sign in to continue watching</p>

		<form method="POST" use:enhance class="auth-form">
			{#if form?.message}
				<div class="auth-error">{form.message}</div>
			{/if}

			<label>
				<span>Username or Email</span>
				<input
					type="text"
					name="username"
					placeholder="Enter your username or email"
					required
					autocomplete="username"
				/>
			</label>

			<label>
				<span>Password</span>
				<input
					type="password"
					name="password"
					placeholder="Enter your password"
					required
					autocomplete="current-password"
				/>
			</label>

			{#if data?.csrfToken}
				<input type="hidden" name="csrf_token" value={data.csrfToken} />
			{/if}

			<Button type="submit" class="w-full auth-submit-btn">Sign In</Button>
		</form>

		<div class="auth-divider">
			<span>or</span>
		</div>

		<p class="auth-footer">
			Don't have an account?
			<a rel="external" href="/signup" class="auth-link">Create one →</a>
		</p>
	</div>
</div>

<style>
	.auth-page {
		min-height: calc(100vh - var(--header-height));
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 2rem 1rem;
	}

	.auth-card {
		width: 100%;
		max-width: 420px;
		padding: 2.5rem;
		border-radius: var(--radius-xl);
		text-align: center;
	}

	.auth-logo {
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
		margin-bottom: 2rem;
	}

	.auth-logo-icon {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 36px;
		height: 36px;
		border-radius: var(--radius-md);
		background: var(--gradient-brand);
		color: white;
		font-size: 0.85rem;
	}

	.auth-logo-text {
		font-size: 1.3rem;
		font-weight: var(--font-weight-extrabold);
		background: var(--gradient-brand-horizontal);
		-webkit-background-clip: text;
		-webkit-text-fill-color: transparent;
		background-clip: text;
	}

	.auth-heading {
		font-size: 1.6rem;
		margin-bottom: 0.25rem;
	}

	.auth-subtitle {
		color: var(--text-secondary);
		font-size: 0.95rem;
		margin-bottom: 1.5rem;
	}

	.auth-error {
		background: rgba(239, 68, 68, 0.12);
		border: 1px solid rgba(239, 68, 68, 0.25);
		color: #f87171;
		padding: 0.75rem 1rem;
		border-radius: var(--radius-md);
		font-size: 0.9rem;
		margin-bottom: 1.5rem;
	}

	.auth-form {
		display: flex;
		flex-direction: column;
		gap: 1.25rem;
		text-align: left;
	}

	.auth-form label {
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
	}

	.auth-form label span {
		font-size: 0.85rem;
		font-weight: var(--font-weight-semibold);
		color: var(--text-secondary);
	}

	.auth-form input {
		padding: 0.75rem 1rem;
		background: var(--bg-input);
		border: 1px solid var(--border-stream);
		border-radius: var(--radius-md);
		color: var(--text-primary);
		font-size: 1rem;
		font-family: inherit;
		transition: border-color var(--transition-fast);
	}

	.auth-form input:focus {
		outline: none;
		border-color: var(--accent-stream);
	}

	.auth-divider {
		display: flex;
		align-items: center;
		gap: 1rem;
		margin: 1.5rem 0;
		color: var(--text-tertiary);
		font-size: 0.85rem;
	}

	.auth-divider::before,
	.auth-divider::after {
		content: '';
		flex: 1;
		height: 1px;
		background: var(--border-stream);
	}

	.auth-footer {
		color: var(--text-secondary);
		font-size: 0.9rem;
	}

	.auth-link {
		color: var(--accent-stream);
		font-weight: var(--font-weight-semibold);
	}

	.auth-link:hover {
		text-decoration: underline;
	}
</style>
