<script lang="ts">
	let { size = 'md', class: className = '' }: { size?: 'sm' | 'md' | 'lg'; class?: string } =
		$props();

	const sizeClasses = {
		sm: 'h-6 w-6',
		md: 'h-8 w-8',
		lg: 'h-10 w-10'
	};
</script>

<div class="sofia-3d {sizeClasses[size]} {className}">
	<div class="sofia-tilt">
		<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
			<defs>
				<linearGradient id="sofiaGold" x1="0%" y1="0%" x2="100%" y2="100%">
					<stop offset="0%" stop-color="#FDE68A" />
					<stop offset="45%" stop-color="#F59E0B" />
					<stop offset="100%" stop-color="#B45309" />
				</linearGradient>
				<linearGradient id="sofiaGem" x1="0%" y1="0%" x2="100%" y2="100%">
					<stop offset="0%" stop-color="#E9D5FF" />
					<stop offset="45%" stop-color="#A855F7" />
					<stop offset="100%" stop-color="#581C87" />
				</linearGradient>
			</defs>
			<path
				d="M5.2 8.4 L6.4 3.6 L9.7 6.2 L12 2.8 L14.3 6.2 L17.6 3.6 L18.8 8.4 L18.8 10.6 L5.2 10.6 Z"
				fill="url(#sofiaGold)"
			/>
			<rect x="5.2" y="9.6" width="13.6" height="1.9" rx="0.95" fill="#92400E" />
			<path
				d="M12 21.2 C8.9 19.3 6.9 17.2 6.9 14.9 A3.9 3.9 0 0 1 12 11.2 A3.9 3.9 0 0 1 17.1 14.9 C17.1 17.2 15.1 19.3 12 21.2 Z"
				fill="url(#sofiaGem)"
				stroke="url(#sofiaGold)"
				stroke-width="1.1"
				stroke-linejoin="round"
			/>
			<path
				class="sofia-facet"
				d="M8.7 14.3 Q9.7 16.7 12 17.5 Q14.3 16.7 15.3 14.3"
				fill="none"
				stroke="#FDE68A"
				stroke-width="0.8"
				stroke-linecap="round"
				opacity="0.8"
			/>
			<circle cx="9.7" cy="14.4" r="0.55" fill="#FDE68A" opacity="0.9" />
			<circle cx="14.3" cy="14.4" r="0.55" fill="#FDE68A" opacity="0.9" />
			<path
				class="sofia-sparkle sofia-sparkle-1"
				d="M2.9 2.4 L3.55 4.15 L5.3 4.8 L3.55 5.45 L2.9 7.2 L2.25 5.45 L0.5 4.8 L2.25 4.15 Z"
				fill="#FDE68A"
			/>
			<path
				class="sofia-sparkle sofia-sparkle-2"
				d="M20.9 1.9 L21.45 3.35 L22.9 3.8 L21.45 4.25 L20.9 5.7 L20.35 4.25 L18.9 3.8 L20.35 3.35 Z"
				fill="#F9A8D4"
			/>
		</svg>
	</div>
</div>

<style>
	.sofia-3d {
		display: block;
		flex-shrink: 0;
		perspective: 120px;
		filter: drop-shadow(0 2px 5px rgba(0, 0, 0, 0.45));
	}

	.sofia-tilt {
		width: 100%;
		height: 100%;
		transform-style: preserve-3d;
		will-change: transform;
		animation: sofia-tilt 5s ease-in-out infinite;
	}

	.sofia-sparkle {
		transform-origin: center;
		animation: sofia-sparkle 2.4s ease-in-out infinite;
	}

	.sofia-facet {
		animation: sofia-shimmer 3.2s ease-in-out infinite;
	}

	.sofia-sparkle-1 {
		animation-delay: 0s;
	}

	.sofia-sparkle-2 {
		animation-delay: 1.2s;
	}

	@keyframes sofia-tilt {
		0%,
		100% {
			transform: rotateX(9deg) rotateY(-9deg) translateY(0);
		}
		50% {
			transform: rotateX(-9deg) rotateY(9deg) translateY(-1.5px);
		}
	}

	@keyframes sofia-sparkle {
		0%,
		100% {
			opacity: 0.3;
			transform: scale(0.7) rotate(0deg);
		}
		50% {
			opacity: 1;
			transform: scale(1.2) rotate(45deg);
		}
	}

	@keyframes sofia-shimmer {
		0%,
		100% {
			opacity: 0.35;
		}
		50% {
			opacity: 0.95;
		}
	}

	:global(.logo:hover) .sofia-tilt {
		animation-duration: 2.2s;
	}

	:global(.logo:hover) .sofia-sparkle {
		animation-duration: 1s;
	}

	@media (prefers-reduced-motion: reduce) {
		.sofia-tilt,
		.sofia-sparkle,
		.sofia-sparkle-1,
		.sofia-sparkle-2,
		.sofia-facet {
			animation: none;
		}

		:global(.logo:hover) .sofia-tilt,
		:global(.logo:hover) .sofia-sparkle {
			animation: none;
		}
	}
</style>
