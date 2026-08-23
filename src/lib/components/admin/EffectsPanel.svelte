<script lang="ts">
	import { onMount } from 'svelte';
	import { getCsrfTokenClient } from '$lib/utils/csrf.client';
	import {
		liveSessions,
		connectLiveSessions,
		isGuestSession,
		sessionLabel
	} from '$lib/admin/liveSessions.svelte';
	import { Ghost, Loader2 } from '@lucide/svelte';

	type EffectType = 'jumpscare' | 'peekaboo' | 'banana' | 'surprise' | 'ghosttyping';

	let selected = $state<string[]>([]);
	let confirming = $state<EffectType | null>(null);
	let globalMode = $state(false);
	let busy = $state(false);
	let ghostSeconds = $state(8);
	let result = $state<{ ok: boolean; message: string } | null>(null);

	const EFFECTS: { type: EffectType; label: string; emoji: string; hint: string }[] = [
		{ type: 'jumpscare', label: 'Jumpscare', emoji: '😱', hint: 'Full-screen scare + sound' },
		{ type: 'peekaboo', label: 'Peekaboo!', emoji: '👀', hint: 'Cute wiggly popup' },
		{
			type: 'banana',
			label: 'Banana cursor',
			emoji: '🍌',
			hint: 'Their mouse is a banana now (8s)'
		},
		{
			type: 'surprise',
			label: "You've been pranked",
			emoji: '🎉',
			hint: 'Silly full-screen surprise'
		},
		{
			type: 'ghosttyping',
			label: 'Ghost typing',
			emoji: '👻',
			hint: 'Fake "someone is typing…" — nothing ever sends'
		}
	];

	onMount(() => connectLiveSessions());

	function toggleSelect(userId: string) {
		if (globalMode) return;
		selected = selected.includes(userId)
			? selected.filter((id) => id !== userId)
			: [...selected, userId];
	}

	function setMode(global: boolean) {
		globalMode = global;
		selected = [];
	}

	async function fire(type: EffectType) {
		if (busy) return;
		const targets = globalMode ? ['all'] : [...selected];
		if (targets.length === 0) return;
		busy = true;
		result = null;
		try {
			const headers: Record<string, string> = { 'Content-Type': 'application/json' };
			const token = await getCsrfTokenClient();
			if (token) headers['X-CSRF-Token'] = token;
			const res = await fetch('/api/admin/effects', {
				method: 'POST',
				headers,
				body: JSON.stringify(
					type === 'ghosttyping' ? { type, targets, seconds: ghostSeconds } : { type, targets }
				),
				credentials: 'include'
			});
			const body = await res.json().catch(() => null);
			if (res.ok && body?.ok) {
				result = {
					ok: true,
					message:
						targets[0] === 'all'
							? type === 'ghosttyping'
								? `Ghost typing everywhere for ${ghostSeconds}s. Nothing will ever arrive.`
								: `Fired ${type} site-wide. Chaos delivered.`
							: `Fired ${type} on ${targets.length} session${targets.length === 1 ? '' : 's'}.`
				};
			} else {
				result = { ok: false, message: body?.error ?? 'Failed to send.' };
			}
		} catch {
			result = { ok: false, message: 'Could not reach the server.' };
		} finally {
			busy = false;
			confirming = null;
		}
	}

	function fmtDuration(fromMs: number): string {
		const mins = Math.max(0, Math.floor((Date.now() - fromMs) / 60000));
		if (mins < 1) return 'just now';
		if (mins < 60) return `${mins}m`;
		return `${Math.floor(mins / 60)}h ${mins % 60}m`;
	}
</script>

<div class="effects">
	<!-- Mode -->
	<div class="mode-row">
		<button
			class="mode-btn"
			class:mode-on={!globalMode}
			type="button"
			onclick={() => setMode(false)}
		>
			🎯 Targeted
		</button>
		<button
			class="mode-btn mode-global"
			class:mode-on={globalMode}
			type="button"
			onclick={() => setMode(true)}
		>
			🌍 Site-wide
		</button>
		{#if !liveSessions.connected}
			<span class="conn-warn">live feed reconnecting…</span>
		{/if}
	</div>

	{#if !globalMode}
		<p class="pick-hint">
			Pick who's getting it ({selected.length} selected):
		</p>
		<div class="target-list">
			{#if liveSessions.users.length === 0}
				<p class="empty">Nobody online right now.</p>
			{:else}
				{#each liveSessions.users as u (u.userId)}
					{@const guest = isGuestSession(u.userId)}
					<button
						type="button"
						class="target-row"
						class:picked={selected.includes(u.userId)}
						onclick={() => toggleSelect(u.userId)}
						aria-pressed={selected.includes(u.userId)}
					>
						<span class="t-avatar" class:t-guest={guest}>
							{guest ? '👻' : u.username.charAt(0).toUpperCase()}
						</span>
						<span class="t-main">
							<span class="t-name">
								{guest ? 'Guest / Anonymous' : u.username}
								{#if u.roomHost}<span class="t-host">host</span>{/if}
							</span>
							<span class="t-meta">
								{u.path ?? '/'} · active {fmtDuration(u.joinedAt)} · sid {sessionLabel(u.userId)}
							</span>
						</span>
						{#if selected.includes(u.userId)}<span class="t-check">✓</span>{/if}
					</button>
				{/each}
			{/if}
		</div>
	{:else}
		<p class="pick-hint pick-warn">⚠️ Site-wide mode — every single person on the site gets it.</p>
	{/if}

	<!-- Effect buttons -->
	<div class="effect-grid">
		{#each EFFECTS as fx (fx.type)}
			<div class="effect-cell">
				<button
					class="effect-btn"
					type="button"
					disabled={busy || (!globalMode && selected.length === 0)}
					onclick={() => (confirming = fx.type)}
				>
					<span class="fx-emoji">{fx.emoji}</span>
					<span class="fx-label">{fx.label}</span>
					<span class="fx-hint">{fx.hint}</span>
				</button>
			</div>
		{/each}
	</div>

	{#if confirming}
		<div class="confirm-bar" role="alertdialog" aria-label="Confirm effect">
			<Ghost size={16} aria-hidden="true" />
			<span class="confirm-text">
				Fire <strong>{confirming}</strong> on
				<strong
					>{globalMode
						? 'EVERYONE on the site'
						: `${selected.length} session${selected.length === 1 ? '' : 's'}`}</strong
				>?
			</span>
			{#if confirming === 'ghosttyping'}
				<label class="ghost-dur">
					for
					<select bind:value={ghostSeconds} disabled={busy}>
						<option value={5}>5s</option>
						<option value={8}>8s</option>
						<option value={12}>12s</option>
					</select>
				</label>
			{/if}
			<button class="btn-fire" type="button" disabled={busy} onclick={() => void fire(confirming!)}>
				{#if busy}<Loader2 size={14} class="spin" />{/if}
				Yes, do it
			</button>
			<button class="btn-cancel" type="button" onclick={() => (confirming = null)}>Cancel</button>
		</div>
	{/if}

	{#if result}
		<div class="fx-result" class:ok={result.ok}>
			{result.ok ? '✅' : '⚠️'}
			{result.message}
		</div>
	{/if}
</div>

<style>
	.effects {
		display: flex;
		flex-direction: column;
		gap: 0.8rem;
	}

	.mode-row {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		flex-wrap: wrap;
	}
	.mode-btn {
		padding: 0.45rem 1rem;
		border-radius: var(--radius-full);
		border: 1px solid var(--border-stream);
		background: var(--bg-root);
		color: var(--text-secondary);
		font-size: 0.82rem;
		font-weight: var(--font-weight-semibold, 600);
		cursor: pointer;
		font-family: inherit;
		transition: all var(--transition-fast);
	}
	.mode-btn.mode-on {
		background: var(--gradient-brand);
		border-color: transparent;
		color: #fff;
	}
	.mode-btn.mode-global.mode-on {
		background: linear-gradient(135deg, #ff6b00, #ff3b30);
	}
	.conn-warn {
		font-size: 0.75rem;
		color: #f87171;
	}

	.pick-hint {
		margin: 0;
		font-size: 0.8rem;
		color: var(--text-secondary);
	}
	.pick-warn {
		color: #fbbf24;
		font-weight: var(--font-weight-semibold, 600);
	}

	.target-list {
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
		max-height: 260px;
		overflow-y: auto;
	}
	.empty {
		margin: 0;
		font-size: 0.8rem;
		color: var(--text-tertiary);
	}
	.target-row {
		display: flex;
		align-items: center;
		gap: 0.65rem;
		padding: 0.5rem 0.7rem;
		border-radius: var(--radius-md);
		border: 1px solid var(--border-stream);
		background: var(--bg-root);
		cursor: pointer;
		text-align: left;
		width: 100%;
		font-family: inherit;
		transition:
			border-color var(--transition-fast),
			background var(--transition-fast);
	}
	.target-row:hover {
		border-color: rgba(168, 85, 247, 0.45);
	}
	.target-row.picked {
		border-color: #a855f7;
		background: rgba(168, 85, 247, 0.12);
	}
	.t-avatar {
		width: 30px;
		height: 30px;
		border-radius: 50%;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		background: var(--gradient-brand);
		color: white;
		font-size: 0.8rem;
		font-weight: 700;
		flex-shrink: 0;
	}
	.t-avatar.t-guest {
		background: linear-gradient(135deg, #475569, #334155);
	}
	.t-main {
		display: flex;
		flex-direction: column;
		gap: 0.05rem;
		min-width: 0;
		flex: 1;
	}
	.t-name {
		font-size: 0.85rem;
		font-weight: var(--font-weight-semibold, 600);
		color: var(--text-primary);
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
	}
	.t-host {
		font-size: 0.6rem;
		text-transform: uppercase;
		padding: 0.02rem 0.35rem;
		border-radius: var(--radius-full);
		background: rgba(244, 114, 182, 0.14);
		color: #f472b6;
	}
	.t-meta {
		font-size: 0.72rem;
		color: var(--text-tertiary);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.t-check {
		color: #a855f7;
		font-weight: 700;
		flex-shrink: 0;
	}

	.effect-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
		gap: 0.6rem;
	}
	.effect-btn {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.25rem;
		padding: 0.8rem 0.6rem;
		border-radius: var(--radius-lg);
		border: 1px solid var(--border-stream);
		background: var(--bg-root);
		cursor: pointer;
		font-family: inherit;
		text-align: center;
		transition: all var(--transition-fast);
	}
	.effect-btn:hover:not(:disabled) {
		border-color: rgba(168, 85, 247, 0.5);
		transform: translateY(-2px);
		box-shadow: 0 6px 20px rgba(168, 85, 247, 0.18);
	}
	.effect-btn:disabled {
		opacity: 0.45;
		cursor: default;
	}
	.fx-emoji {
		font-size: 1.7rem;
		line-height: 1;
	}
	.fx-label {
		font-size: 0.85rem;
		font-weight: var(--font-weight-semibold, 600);
		color: var(--text-primary);
	}
	.fx-hint {
		font-size: 0.68rem;
		color: var(--text-tertiary);
		line-height: 1.3;
	}

	.confirm-bar {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		flex-wrap: wrap;
		padding: 0.7rem 1rem;
		border-radius: var(--radius-md);
		background: rgba(255, 107, 0, 0.08);
		border: 1px solid rgba(255, 107, 0, 0.4);
		color: var(--text-primary);
		font-size: 0.85rem;
	}
	.confirm-text strong {
		text-transform: uppercase;
		letter-spacing: 0.03em;
	}
	.btn-fire {
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
		padding: 0.45rem 0.9rem;
		border-radius: var(--radius-md);
		border: none;
		background: linear-gradient(135deg, #ff6b00, #ff3b30);
		color: #fff;
		font-weight: var(--font-weight-semibold, 600);
		font-size: 0.8rem;
		cursor: pointer;
		font-family: inherit;
	}
	.ghost-dur {
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
		font-size: 0.78rem;
		color: var(--text-secondary, #a1a1aa);
	}
	.ghost-dur select {
		padding: 0.3rem 0.5rem;
		border-radius: 8px;
		border: 1px solid var(--border-stream, rgba(255, 255, 255, 0.14));
		background: var(--bg-elevated, #18181b);
		color: var(--text-primary, #fafafa);
		font-size: 0.78rem;
	}
	.btn-cancel {
		padding: 0.45rem 0.9rem;
		border-radius: var(--radius-md);
		border: 1px solid var(--border-stream);
		background: transparent;
		color: var(--text-secondary);
		font-size: 0.8rem;
		cursor: pointer;
		font-family: inherit;
	}

	.fx-result {
		padding: 0.55rem 0.9rem;
		border-radius: var(--radius-md);
		font-size: 0.82rem;
	}
	.fx-result.ok {
		background: rgba(34, 197, 94, 0.1);
		border: 1px solid rgba(34, 197, 94, 0.35);
		color: #4ade80;
	}
	.fx-result:not(.ok) {
		background: rgba(239, 68, 68, 0.1);
		border: 1px solid rgba(239, 68, 68, 0.35);
		color: #f87171;
	}

	:global(.spin) {
		animation: fx-spin 1s linear infinite;
	}
	@keyframes fx-spin {
		to {
			transform: rotate(360deg);
		}
	}
</style>
