<script lang="ts">
	let { size = 'md', class: className = '' }: { size?: 'sm' | 'md' | 'lg'; class?: string } =
		$props();

	const sizeClasses = {
		sm: 'h-6 w-auto',
		md: 'h-8 w-auto',
		lg: 'h-10 w-auto'
	};
</script>

<svg
	class="midnight-logo {sizeClasses[size]} {className}"
	viewBox="0 0 120 80"
	fill="none"
	xmlns="http://www.w3.org/2000/svg"
	aria-hidden="true"
>
	<defs>
		<linearGradient id="midnightGradient" x1="0%" y1="0%" x2="100%" y2="0%">
			<stop offset="0%" stop-color="#4F46E5" stop-opacity="1" />
			<stop offset="25%" stop-color="#7C3AED" stop-opacity="1" />
			<stop offset="50%" stop-color="#EC4899" stop-opacity="1" />
			<stop offset="75%" stop-color="#06B6D4" stop-opacity="1" />
			<stop offset="100%" stop-color="#22D3EE" stop-opacity="1" />
		</linearGradient>
		<linearGradient id="midnightGradientVertical" x1="0%" y1="0%" x2="0%" y2="100%">
			<stop offset="0%" stop-color="#4F46E5" stop-opacity="1" />
			<stop offset="50%" stop-color="#7C3AED" stop-opacity="1" />
			<stop offset="100%" stop-color="#06B6D4" stop-opacity="1" />
		</linearGradient>
		<filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
			<feGaussianBlur stdDeviation="3" result="blur" />
			<feMerge>
				<feMergeNode in="blur" />
				<feMergeNode in="SourceGraphic" />
			</feMerge>
		</filter>
	</defs>

	<!-- Crescent moon icon -->
	<g filter="url(#glow)">
		<path
			d="M20 12 C20 16.4183 16.4183 20 12 20 C5.37258 20 0.5 15.1274 0.5 8.5 C0.5 6.567 1.5 4.735 3 3.5 C4.5 2.5 6.5 2.5 8 3.5 C10 2.5 11 4 11 6 C11 8.20914 9.20914 10 7 10 C4.79086 10 3 8.20914 3 6 C3 3.79086 4.79086 2 7 2 C10.3137 2 13 4.68629 13 8 C13 9.65685 11.6569 11 10 11 C8.34315 11 7 9.65685 7 8 C7 6.89543 7.89543 6 9 6 C10.1046 6 11 6.89543 11 8 C11 9.65685 9.65685 11 8 11 C6.34315 11 5 9.65685 5 8 C5 6.89543 5.89543 6 7 6 C8.65685 6 10 7.34315 10 9 C10 10.6569 8.65685 12 7 12 C4.23858 12 2 9.76142 2 7 C2 4.23858 4.23858 2 7 2 C9.97056 2 12.5 4.53 12.5 8 C12.5 11.53 9.97056 14 7 14 C3.13401 14 0.5 11.366 0.5 8 C0.5 5.234 2.634 3 5 3 C7.20914 3 9 4.79086 9 7 C9 8.10457 8.10457 9 8 9 C6.89543 9 6 8.10457 6 8 C6 7.44772 6.44772 7 7 7 C8.10457 7 9 7.89543 9 9 C9 9.55228 8.55228 10 8 10 C7.44772 10 7 9.55228 7 9 C6.44772 9 6 8.44772 6 8 C6 7.44772 6.44772 7 7 7 Z"
			fill="url(#midnightGradient)"
			transform="translate(10 18) scale(0.65)"
		/>
	</g>

	<!-- Midnight wordmark -->
	<text
		x="50"
		y="58"
		font-family="system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
		font-size="28"
		font-weight="700"
		letter-spacing="-0.02em"
		fill="url(#midnightGradient)"
		text-anchor="middle"
		filter="url(#glow)"
	>
		Midnight
	</text>
</svg>

<style>
	.midnight-logo {
		display: block;
		flex-shrink: 0;
	}
</style>
