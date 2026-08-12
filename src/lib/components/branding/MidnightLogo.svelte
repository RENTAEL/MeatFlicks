<script lang="ts">
	let { size = 'md', class: className = '' }: { size?: 'sm' | 'md' | 'lg'; class?: string } =
		$props();

	const sizeClasses = {
		sm: 'h-6 w-6',
		md: 'h-8 w-8',
		lg: 'h-10 w-10'
	};
</script>

<div class="midnight-3d {sizeClasses[size]} {className}">
	<div class="midnight-tilt">
		<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
			<defs>
				<radialGradient id="midnightMoon" cx="38%" cy="32%" r="85%">
					<stop offset="0%" stop-color="#E0E7FF" />
					<stop offset="35%" stop-color="#818CF8" />
					<stop offset="70%" stop-color="#4F46E5" />
					<stop offset="100%" stop-color="#312E81" />
				</radialGradient>
				<linearGradient id="midnightStar" x1="0%" y1="0%" x2="100%" y2="100%">
					<stop offset="0%" stop-color="#FDE68A" />
					<stop offset="100%" stop-color="#C7D2FE" />
				</linearGradient>
				<filter id="midnightGlow" x="-60%" y="-60%" width="220%" height="220%">
					<feGaussianBlur stdDeviation="2.2" />
				</filter>
			</defs>
			<circle
				class="midnight-glow"
				cx="12"
				cy="12"
				r="9"
				fill="#6366F1"
				filter="url(#midnightGlow)"
				opacity="0.55"
			/>
			<path
				d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"
				fill="url(#midnightMoon)"
				stroke="#A5B4FC"
				stroke-width="0.6"
				stroke-opacity="0.55"
			/>
			<path
				class="midnight-star midnight-star-1"
				d="M18.6 4.6 L19.15 6.05 L20.6 6.6 L19.15 7.15 L18.6 8.6 L18.05 7.15 L16.6 6.6 L18.05 6.05 Z"
				fill="url(#midnightStar)"
			/>
			<path
				class="midnight-star midnight-star-2"
				d="M4.2 15.4 L4.6 16.4 L5.6 16.8 L4.6 17.2 L4.2 18.2 L3.8 17.2 L2.8 16.8 L3.8 16.4 Z"
				fill="url(#midnightStar)"
			/>
			<circle class="midnight-star midnight-star-3" cx="17" cy="16.5" r="0.7" fill="#C7D2FE" />
		</svg>
	</div>
</div>

<style>
	.midnight-3d {
		display: block;
		flex-shrink: 0;
		perspective: 120px;
		filter: drop-shadow(0 2px 5px rgba(49, 46, 129, 0.55));
	}

	.midnight-tilt {
		width: 100%;
		height: 100%;
		transform-style: preserve-3d;
		will-change: transform;
		animation: midnight-tilt 6s ease-in-out infinite;
	}

	.midnight-glow {
		will-change: opacity;
		animation: midnight-glow 3.6s ease-in-out infinite;
	}

	.midnight-star {
		transform-origin: center;
		animation: midnight-twinkle 2.8s ease-in-out infinite;
	}

	.midnight-star-2 {
		animation-delay: 0.9s;
	}

	.midnight-star-3 {
		animation-delay: 1.7s;
	}

	@keyframes midnight-tilt {
		0%,
		100% {
			transform: rotateX(10deg) rotateY(-10deg) translateY(0);
		}
		50% {
			transform: rotateX(-10deg) rotateY(10deg) translateY(-1.5px);
		}
	}

	@keyframes midnight-glow {
		0%,
		100% {
			opacity: 0.45;
		}
		50% {
			opacity: 0.85;
		}
	}

	@keyframes midnight-twinkle {
		0%,
		100% {
			opacity: 0.35;
			transform: scale(0.75);
		}
		50% {
			opacity: 1;
			transform: scale(1.15);
		}
	}

	:global(.logo:hover) .midnight-tilt {
		animation-duration: 2.6s;
	}

	@media (prefers-reduced-motion: reduce) {
		.midnight-tilt,
		.midnight-glow,
		.midnight-star,
		.midnight-star-2,
		.midnight-star-3 {
			animation: none;
		}

		:global(.logo:hover) .midnight-tilt {
			animation: none;
		}
	}
</style>
