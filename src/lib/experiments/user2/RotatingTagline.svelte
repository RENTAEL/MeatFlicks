<script lang="ts">
	import { getRandomTagline } from '../user2';

	const tagline = getRandomTagline();
</script>

<p class="tagline">{tagline}</p>

<style>
	.tagline {
		margin: 0.15rem 0 0;
		font-size: 0.85rem;
		color: var(--text-secondary);
		font-style: italic;
	}
</style>
