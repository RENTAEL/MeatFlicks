<script lang="ts">
	let { size = 'md', class: className = '' }: { size?: 'sm' | 'md' | 'lg'; class?: string } =
		$props();

	const sizeClasses = {
		sm: 'h-6 w-6',
		md: 'h-8 w-8',
		lg: 'h-10 w-10'
	};
</script>

<div class="custom-3d {sizeClasses[size]} {className}">
	<div class="custom-float">
		<div class="custom-orb">
			<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
				<defs>
					<radialGradient id="customCore" cx="35%" cy="30%" r="80%">
						<stop offset="0%" stop-color="#FFFFFF" />
						<stop offset="25%" stop-color="#22D3EE" />
						<stop offset="65%" stop-color="#8B5CF6" />
						<stop offset="100%" stop-color="#4C1D95" />
					</radialGradient>
					<linearGradient id="customRing" x1="0%" y1="0%" x2="100%" y2="100%">
						<stop offset="0%" stop-color="#22D3EE" />
						<stop offset="50%" stop-color="#F0ABFC" />
						<stop offset="100%" stop-color="#22D3EE" />
					</linearGradient>
				</defs>
				<g class="custom-ring">
					<circle
						cx="12"
						cy="12"
						r="10.2"
						stroke="url(#customRing)"
						stroke-width="1.6"
						stroke-linecap="round"
						stroke-dasharray="14 10"
						opacity="0.9"
					/>
					<circle class="custom-orbit" cx="12" cy="1.8" r="1.15" fill="#67E8F9" />
				</g>
				<circle cx="12" cy="12" r="8" fill="url(#customCore)" />
				<circle cx="9.6" cy="9.6" r="2.3" fill="#FFFFFF" opacity="0.35" />
			</svg>
			<span class="custom-sheen"></span>
		</div>
	</div>
</div>

<style>
	.custom-3d {
		display: block;
		flex-shrink: 0;
		filter: drop-shadow(0 0 5px rgba(34, 211, 238, 0.55)) drop-shadow(0 0 12px rgba(139, 92, 246, 0.35));
	}

	.custom-float {
		width: 100%;
		height: 100%;
		will-change: transform;
		animation: custom-float 4.5s ease-in-out infinite;
	}

	.custom-orb {
		position: relative;
		width: 100%;
		height: 100%;
		border-radius: 9999px;
		overflow: hidden;
	}

	.custom-orb svg {
		display: block;
		width: 100%;
		height: 100%;
	}

	.custom-ring {
		transform-origin: center;
		will-change: transform;
		animation: custom-rotate 5s linear infinite;
	}

	.custom-sheen {
		position: absolute;
		inset: 0;
		border-radius: 9999px;
		pointer-events: none;
		background: linear-gradient(
			105deg,
			transparent 42%,
			rgba(255, 255, 255, 0.4) 50%,
			transparent 58%
		);
		animation: custom-sheen 3.4s ease-in-out infinite;
	}

	@keyframes custom-rotate {
		to {
			transform: rotate(360deg);
		}
	}

	@keyframes custom-float {
		0%,
		100% {
			transform: translateY(0);
		}
		50% {
			transform: translateY(-1.5px);
		}
	}

	@keyframes custom-sheen {
		0% {
			transform: translateX(-130%);
			opacity: 0;
		}
		45% {
			opacity: 1;
		}
		60%,
		100% {
			transform: translateX(130%);
			opacity: 0;
		}
	}

	:global(.logo:hover) .custom-float {
		animation-duration: 2s;
	}

	@media (prefers-reduced-motion: reduce) {
		.custom-float,
		.custom-ring,
		.custom-sheen {
			animation: none;
		}

		:global(.logo:hover) .custom-float {
			animation: none;
		}
	}
</style>