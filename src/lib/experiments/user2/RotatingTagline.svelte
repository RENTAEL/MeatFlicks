<script lang="ts">
	import { getRandomTagline } from '../user2';

	// Module-level cache: one tagline per page load, stable across HMR/re-renders
	const taglines: string[] = (globalThis as any).__streamiumTaglines ?? [];
	if (taglines.length === 0) taglines.push(getRandomTagline());
	const tagline = taglines[0];
</script>

<p class="tagline">{tagline}</p>

<style>
	.tagline {
		margin: 0.15rem 0 0;
		font-size: 0.85rem;
		color: var(--text-secondary);
		font-style: italic;
		min-height: 1.3em; /* reserved line — no shift when email/member-since render below */
	}
</style>
