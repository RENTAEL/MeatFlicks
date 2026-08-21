<script lang="ts">
	import { page } from '$app/state';
	import { isUser2, getRandomTagline } from '../user2';

	const user = $derived(page.data.user ?? null);
	const enabled = $derived(isUser2(user as any));
	const tagline = getRandomTagline();
</script>

{#if enabled}
	<p class="tagline">{tagline}</p>
{/if}

<style>
	.tagline {
		margin: 0.15rem 0 0;
		font-size: 0.85rem;
		color: var(--text-secondary);
		font-style: italic;
	}
</style>
