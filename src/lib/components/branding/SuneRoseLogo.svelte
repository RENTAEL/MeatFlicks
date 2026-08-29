<script lang="ts">
	// Sune — dark-regal rose crest. Scales from favicon → brand mark.
	let {
		size = 'md',
		class: className = ''
	}: { size?: 'sm' | 'md' | 'lg' | number; class?: string } = $props();

	const dim =
		size === 'sm' ? 20 : size === 'lg' ? 40 : size === 'md' ? 28 : (size as number);
</script>

<svg
	width={dim}
	height={dim}
	viewBox="0 0 64 64"
	class="sune-rose {className}"
	role="img"
	aria-label="Sune — rose crest"
	xmlns="http://www.w3.org/2000/svg"
>
	<g fill="none" stroke="#d4af37" stroke-width="1.1" stroke-linejoin="round">
		<!-- outer petals: deep burgundy -->
		<g fill="#7a1626">
			<path d="M32 32 C 21 27, 19 13, 32 9 C 45 13, 43 27, 32 32 Z" transform="rotate(0 32 32)" />
			<path d="M32 32 C 21 27, 19 13, 32 9 C 45 13, 43 27, 32 32 Z" transform="rotate(72 32 32)" />
			<path d="M32 32 C 21 27, 19 13, 32 9 C 45 13, 43 27, 32 32 Z" transform="rotate(144 32 32)" />
			<path d="M32 32 C 21 27, 19 13, 32 9 C 45 13, 43 27, 32 32 Z" transform="rotate(216 32 32)" />
			<path d="M32 32 C 21 27, 19 13, 32 9 C 45 13, 43 27, 32 32 Z" transform="rotate(288 32 32)" />
		</g>
		<!-- inner petals: crimson, lighter gold edge -->
		<g fill="#a51d33" stroke="#e7c663" stroke-width="0.8">
			<path d="M32 32 C 26 29, 25 19, 32 15 C 39 19, 38 29, 32 32 Z" transform="rotate(36 32 32)" />
			<path d="M32 32 C 26 29, 25 19, 32 15 C 39 19, 38 29, 32 32 Z" transform="rotate(108 32 32)" />
			<path d="M32 32 C 26 29, 25 19, 32 15 C 39 19, 38 29, 32 32 Z" transform="rotate(180 32 32)" />
			<path d="M32 32 C 26 29, 25 19, 32 15 C 39 19, 38 29, 32 32 Z" transform="rotate(252 32 32)" />
			<path d="M32 32 C 26 29, 25 19, 32 15 C 39 19, 38 29, 32 32 Z" transform="rotate(324 32 32)" />
		</g>
	</g>
	<!-- crowning bud -->
	<circle cx="32" cy="32" r="5.2" fill="#e7c663" stroke="#8a6a1f" stroke-width="0.6" />
	<circle cx="32" cy="32" r="1.8" fill="#5e0f1c" />
</svg>

<style>
	.sune-rose {
		display: block;
		filter: drop-shadow(0 0 6px rgba(212, 175, 55, 0.28));
	}
</style>
