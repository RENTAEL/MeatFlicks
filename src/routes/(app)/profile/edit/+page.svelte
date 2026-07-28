<script lang="ts">
	import type { PageData } from './$types';
	import { enhance } from '$app/forms';
	import { goto } from '$app/navigation';
	import { SEOHead } from '$lib/components/seo';

	let { data, form }: { data: PageData; form: any } = $props();

	let errors = $derived(form?.errors || {});
	let success = $derived(form?.success || false);
	let values = $derived(form?.values || {});
</script>

<SEOHead title="Edit Profile — Streamium" description="Edit your Streamium profile" noindex />

<div class="edit-page">
	<button class="back-btn" onclick={() => goto('/profile')}>← Back to Profile</button>

	<h1>Edit Profile</h1>

	{#if success}
		<div class="success-banner">Profile updated successfully!</div>
	{/if}

	<form method="POST" use:enhance class="edit-form">
		<label>
			<span>Username</span>
			<input
				type="text"
				name="username"
				value={values.username || data.user.username}
				placeholder={data.user.username}
				class:error={errors.username}
			/>
			{#if errors.username}
				<span class="field-error">{errors.username}</span>
			{/if}
		</label>

		<label>
			<span>Email</span>
			<input type="email"
				name="email"
				value={values.email ?? data.user.email ?? ''}
				placeholder={data.user.email || 'you@example.com'}
				class:error={errors.email}
			/>
			{#if errors.email}
				<span class="field-error">{errors.email}</span>
			{/if}
		</label>

		<fieldset>
			<legend>Change Password (optional)</legend>

			<label>
				<span>Current Password</span>
				<input
					type="password"
					name="currentPassword"
					placeholder="Enter current password"
					class:error={errors.currentPassword}
				/>
				{#if errors.currentPassword}
					<span class="field-error">{errors.currentPassword}</span>
				{/if}
			</label>

			<label>
				<span>New Password</span>
				<input
					type="password"
					name="newPassword"
					placeholder="At least 8 characters"
					class:error={errors.newPassword}
				/>
				{#if errors.newPassword}
					<span class="field-error">{errors.newPassword}</span>
				{/if}
			</label>
		</fieldset>

		<div class="form-actions">
			<button type="submit" class="save-btn">Save Changes</button>
			<button type="button" class="cancel-btn" onclick={() => goto('/profile')}>
				Cancel
			</button>
		</div>
	</form>
</div>

<style>
	.edit-page {
		max-width: 500px;
		margin: 0 auto;
		padding: 2rem 1rem;
	}

	.back-btn {
		background: none;
		border: none;
		color: var(--accent, #6366f1);
		cursor: pointer;
		font-size: 0.95rem;
		padding: 0;
		margin-bottom: 1.5rem;
	}

	.back-btn:hover {
		text-decoration: underline;
	}

	h1 {
		font-size: 1.8rem;
		margin: 0 0 2rem;
		color: var(--text-primary, #fff);
	}

	.success-banner {
		background: #065f46;
		color: #a7f3d0;
		padding: 1rem;
		border-radius: 8px;
		margin-bottom: 1.5rem;
		font-size: 0.95rem;
	}

	.edit-form {
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
	}

	label {
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
	}

	label span {
		font-size: 0.9rem;
		font-weight: 600;
		color: var(--text-secondary, #94a3b8);
	}

	input {
		padding: 0.75rem 1rem;
		background: var(--bg-input, #1e293b);
		border: 1px solid var(--border, #334155);
		border-radius: 8px;
		color: var(--text-primary, #fff);
		font-size: 1rem;
		transition: border-color 0.2s;
	}

	input:focus {
		outline: none;
		border-color: var(--accent, #6366f1);
	}

	input.error {
		border-color: #ef4444;
	}

	.field-error {
		color: #f87171;
		font-size: 0.8rem;
	}

	fieldset {
		border: 1px solid var(--border, #334155);
		border-radius: 10px;
		padding: 1.5rem;
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	legend {
		font-size: 0.95rem;
		font-weight: 600;
		color: var(--text-secondary, #94a3b8);
		padding: 0 0.5rem;
	}

	.form-actions {
		display: flex;
		gap: 1rem;
		margin-top: 1rem;
	}

	.save-btn {
		flex: 1;
		padding: 0.75rem;
		background: var(--accent, #6366f1);
		color: white;
		border: none;
		border-radius: 8px;
		font-size: 1rem;
		font-weight: 600;
		cursor: pointer;
		transition: opacity 0.2s;
	}

	.save-btn:hover {
		opacity: 0.9;
	}

	.cancel-btn {
		padding: 0.75rem 1.5rem;
		background: var(--bg-input, #1e293b);
		border: 1px solid var(--border, #334155);
		border-radius: 8px;
		color: var(--text-secondary, #94a3b8);
		cursor: pointer;
		font-size: 1rem;
	}
</style>
