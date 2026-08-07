<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { Users, Ticket, ArrowRight } from '@lucide/svelte';

	let code = $state('');

	const CODE_RE = /^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{6}$/;

	function join() {
		const clean = code.trim().toUpperCase();
		if (!CODE_RE.test(clean)) return;
		goto(`/watch/${clean}`);
	}
</script>

<svelte:head>
	<title>Watch Party · Streamium</title>
</svelte:head>

<div class="wp-page">
	<div class="wp-card">
		<div class="wp-hero">
			<div class="wp-icon">
				<Users size={40} />
			</div>
			<h1>Watch Party</h1>
			<p class="wp-tag">Stream the same movie or show in sync with friends. Real-time playback, chat, and sound effects.</p>
		</div>

		<div class="wp-actions">
			<a href="/movies" class="wp-action">
				<span class="wp-action-icon"><Ticket size={20} /></span>
				<div class="wp-action-body">
					<span class="wp-action-title">Start a party</span>
					<span class="wp-action-sub">Pick a movie or show to create a room</span>
				</div>
				<ArrowRight size={18} />
			</a>

			<form class="wp-join" onsubmit={(e) => { e.preventDefault(); join(); }}>
				<span class="wp-action-icon"><Users size={20} /></span>
				<div class="wp-action-body">
					<span class="wp-action-title">Join with a code</span>
					<span class="wp-action-sub">Enter the 6-letter room code someone shared</span>
				</div>
				<input
					class="wp-code"
					value={code}
					oninput={(e) => (code = (e.currentTarget as HTMLInputElement).value.toUpperCase())}
					placeholder="ABCD12"
					maxlength="6"
					aria-label="Room code"
				/>
				<button
					class="wp-go"
					type="submit"
					aria-label="Join room"
					disabled={!CODE_RE.test(code.trim().toUpperCase())}
				>
					<ArrowRight size={18} />
				</button>
			</form>
		</div>

		{#if !page.data.user}
			<p class="wp-login-note">
				Party rooms require a free account.
				<a href="/login?next=/watch-party" class="wp-login-link">Sign in</a>
				or <a href="/signup" class="wp-login-link">create one</a>.
			</p>
		{/if}
	</div>
</div>

<style>
	.wp-page {
		min-height: 60vh;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 5rem 1.5rem 3rem;
	}
	.wp-card {
		width: 100%;
		max-width: 520px;
		padding: 2.5rem;
		background: var(--bg-card);
		border: 1px solid var(--border-stream);
		border-radius: var(--radius-xl);
		display: flex;
		flex-direction: column;
		gap: 2rem;
	}
.wp-hero {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.75rem;
		text-align: center;
	}
	.wp-icon {
		width: 72px;
		height: 72px;
		border-radius: 50%;
		background: var(--gradient-brand);
		color: white;
		display: flex;
		align-items: center;
		justify-content: center;
	}
	.wp-hero h1 { font-size: 1.75rem; font-weight: var(--font-weight-extrabold); margin: 0; }
	.wp-tag { color: var(--text-secondary); font-size: 0.95rem; line-height: 1.5; margin: 0; }

	.wp-actions { display: flex; flex-direction: column; gap: 0.75rem; }
	.wp-action,
	.wp-join {
		display: flex;
		align-items: center;
		gap: 0.9rem;
		padding: 1rem 1.1rem;
		border-radius: var(--radius-lg);
		background: var(--bg-card-hover);
		border: 1px solid var(--border-stream);
		text-decoration: none;
		color: var(--text-primary);
		transition: all var(--transition-fast);
	}
	.wp-action:hover { border-color: var(--accent-color, #818cf8); transform: translateY(-1px); }
	.wp-action-icon {
		width: 40px;
		height: 40px;
		flex-shrink: 0;
		border-radius: var(--radius-md);
		background: var(--bg-card);
		border: 1px solid var(--border-stream);
		display: inline-flex;
		align-items: center;
		justify-content: center;
		color: var(--accent-color, #818cf8);
	}
	.wp-action-body { display: flex; flex-direction: column; gap: 0.15rem; flex: 1; min-width: 0; }
	.wp-action-title { font-weight: var(--font-weight-semibold); font-size: 0.95rem; }
	.wp-action-sub { color: var(--text-tertiary); font-size: 0.8rem; }

	.wp-code {
		flex-shrink: 0;
		width: 110px;
		padding: 0.55rem 0.6rem;
		border-radius: var(--radius-sm);
		background: var(--bg-card);
		border: 1px solid var(--border-stream);
		color: var(--text-primary);
		font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
		font-size: 1rem;
		font-weight: 700;
		letter-spacing: 0.12em;
		text-align: center;
		outline: none;
	}
	.wp-code:focus { border-color: var(--accent-color, #818cf8); }
	.wp-go {
		flex-shrink: 0;
		width: 40px;
		height: 40px;
		border-radius: var(--radius-md);
		background: var(--gradient-brand);
		color: white;
		border: none;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		cursor: pointer;
	}
	.wp-go:disabled { opacity: 0.35; cursor: not-allowed; }

	.wp-login-note { color: var(--text-secondary); font-size: 0.8rem; text-align: center; margin: 0; }
	.wp-login-link { color: var(--accent-color, #818cf8); font-weight: var(--font-weight-semibold); }
</style>