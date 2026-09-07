<script lang="ts">
	// Shared coffee-cup icon — matched stroke weight for the dark-regal theme.
	let { size = 18, class: className = '' }: { size?: number; class?: string } = $props();
</script>

<svg
	width={size}
	height={size}
	viewBox="0 0 24 24"
	fill="none"
	stroke="currentColor"
	stroke-width="1.8"
	stroke-linecap="round"
	stroke-linejoin="round"
	class={className}
	aria-hidden="true"
>
	<!-- cup body -->
	<path d="M3 9h13v8a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4V9Z" />
	<!-- handle -->
	<path d="M16 10h1.5a3 3 0 1 1 0 6H16" />
	<!-- steam -->
	<path d="M7 5.5c0-1 .8-1.2.8-2.2" />
	<path d="M10.5 5.5c0-1 .8-1.2 .8-2.2" />
	<path d="M14 5.5c0-1 .8-1.2 .8-2.2" />
</svg>
