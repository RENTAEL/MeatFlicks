<script lang="ts">
	let { size = 'md', class: className = '' }: { size?: 'sm' | 'md' | 'lg'; class?: string } =
		$props();

	const sizeClasses = {
		sm: 'h-6 w-6',
		md: 'h-8 w-8',
		lg: 'h-10 w-10'
	};
</script>

<div class="demon-eye-3d {sizeClasses[size]} {className}">
	<div class="demon-eye-float">
		<div class="demon-eye-orb">
			<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
				<defs>
					<!-- Iris: deep demon red to flame orange, dark moody center -->
					<radialGradient id="demonIris" cx="50%" cy="50%" r="55%">
						<stop offset="0%" stop-color="#0a0a0a" />
						<stop offset="18%" stop-color="#1a0a0a" />
						<stop offset="35%" stop-color="#7f1d1d" />
						<stop offset="58%" stop-color="#dc2626" />
						<stop offset="78%" stop-color="#ff4500" />
						<stop offset="92%" stop-color="#ff8c00" />
						<stop offset="100%" stop-color="#ff3b30" />
					</radialGradient>
					<!-- Sclera highlight -->
					<radialGradient id="demonSclera" cx="35%" cy="30%" r="85%">
						<stop offset="0%" stop-color="#fff7f0" />
						<stop offset="28%" stop-color="#ffe4d6" />
						<stop offset="55%" stop-color="#ffcec2" />
						<stop offset="100%" stop-color="#e8a090" />
					</radialGradient>
					<!-- Flame outer glow -->
					<radialGradient id="demonFlameGlow" cx="50%" cy="50%" r="75%">
						<stop offset="65%" stop-color="rgba(255,59,48,0)" />
						<stop offset="85%" stop-color="rgba(255,69,0,0.35)" />
						<stop offset="100%" stop-color="rgba(255,140,0,0.55)" />
					</radialGradient>
					<!-- Vertical slit pupil gradient -->
					<linearGradient id="demonPupil" x1="50%" y1="0%" x2="50%" y2="100%">
						<stop offset="0%" stop-color="#000000" />
						<stop offset="45%" stop-color="#1a0000" />
						<stop offset="100%" stop-color="#000000" />
					</linearGradient>
					<filter id="demonShadow" x="-50%" y="-50%" width="200%" height="200%">
						<feDropShadow
							dx="0"
							dy="1.5"
							stdDeviation="1.2"
							flood-color="#000"
							flood-opacity="0.55"
						/>
					</filter>
					<filter id="demonGlow" x="-50%" y="-50%" width="200%" height="200%">
						<feGaussianBlur stdDeviation="0.9" />
					</filter>
				</defs>

				<!-- Outer flame glow -->
				<ellipse cx="12" cy="12" rx="11" ry="7.5" fill="url(#demonFlameGlow)" opacity="0.9" />

				<!-- Eye white/sclera with 3D depth -->
				<g filter="url(#demonShadow)">
					<path
						d="M2.2 12 C 6.2 5.2 17.8 5.2 21.8 12 C 17.8 18.8 6.2 18.8 2.2 12 Z"
						fill="url(#demonSclera)"
						stroke="rgba(120,20,20,0.35)"
						stroke-width="0.4"
					/>
					<!-- Subtle inner shadow for depth -->
					<path
						d="M2.2 12 C 6.2 5.2 17.8 5.2 21.8 12 C 17.8 18.8 6.2 18.8 2.2 12 Z"
						fill="none"
						stroke="rgba(0,0,0,0.18)"
						stroke-width="1.2"
						opacity="0.5"
					/>
				</g>

				<!-- Iris -->
				<g class="demon-iris">
					<ellipse cx="12" cy="12" rx="6.2" ry="6.2" fill="url(#demonIris)" />
					<!-- Iris texture rings -->
					<ellipse
						cx="12"
						cy="12"
						rx="5.1"
						ry="5.1"
						fill="none"
						stroke="rgba(255,200,160,0.18)"
						stroke-width="0.35"
					/>
					<ellipse
						cx="12"
						cy="12"
						rx="3.8"
						ry="3.8"
						fill="none"
						stroke="rgba(255,140,0,0.22)"
						stroke-width="0.25"
					/>
					<!-- Subtle flame veins -->
					<path
						d="M12 6.2 C 10.8 8.1 10.6 10.2 12 12 C 13.4 10.2 13.2 8.1 12 6.2"
						fill="rgba(255,80,20,0.18)"
					/>
					<path
						d="M12 17.8 C 10.8 15.9 10.6 13.8 12 12 C 13.4 13.8 13.2 15.9 12 17.8"
						fill="rgba(120,10,10,0.22)"
					/>
				</g>

				<!-- Vertical slit pupil - iconic demon eye -->
				<ellipse
					cx="12"
					cy="12"
					rx="1.05"
					ry="4.6"
					fill="url(#demonPupil)"
					stroke="rgba(255,80,30,0.55)"
					stroke-width="0.35"
				/>
				<!-- Pupil inner highlight for 3D -->
				<ellipse cx="12" cy="12" rx="0.38" ry="2.8" fill="rgba(0,0,0,0.9)" />
				<!-- Thin vertical highlight on pupil -->
				<rect x="11.72" y="8.2" width="0.55" height="7.6" rx="0.27" fill="rgba(255,255,255,0.12)" />

				<!-- Catchlights for 3D gloss -->
				<ellipse cx="9.1" cy="8.9" rx="1.35" ry="1.1" fill="white" opacity="0.92" />
				<ellipse cx="9.3" cy="9.1" rx="0.55" ry="0.45" fill="white" opacity="0.55" />
				<ellipse cx="15.2" cy="14.6" rx="0.55" ry="0.42" fill="white" opacity="0.28" />

				<!-- Top eyelid shadow for depth -->
				<path
					d="M2.2 12 C 6.2 5.2 17.8 5.2 21.8 12 C 21.1 10.2 19.2 8.4 16.5 7 C 13.8 5.6 10.2 5.6 7.5 7 C 4.8 8.4 2.9 10.2 2.2 12"
					fill="rgba(0,0,0,0.18)"
					opacity="0.7"
				/>
				<!-- Bottom eyelid highlight -->
				<path
					d="M2.2 12 C 6.2 18.8 17.8 18.8 21.8 12 C 21.1 13.5 19.3 15 16.7 16.1 C 14.1 17.2 9.9 17.2 7.3 16.1 C 4.7 15 2.9 13.5 2.2 12"
					fill="rgba(255,220,200,0.12)"
					opacity="0.5"
				/>
			</svg>
			<span class="demon-sheen"></span>
		</div>
	</div>
</div>

<style>
	.demon-eye-3d {
		display: block;
		flex-shrink: 0;
		filter: drop-shadow(0 1px 3px rgba(0, 0, 0, 0.6)) drop-shadow(0 0 8px rgba(255, 59, 48, 0.45))
			drop-shadow(0 0 14px rgba(255, 140, 0, 0.25));
	}

	.demon-eye-float {
		width: 100%;
		height: 100%;
		will-change: transform;
		animation: demon-float 4.2s ease-in-out infinite;
	}

	.demon-eye-orb {
		position: relative;
		width: 100%;
		height: 100%;
		border-radius: 9999px;
		overflow: visible;
	}

	.demon-eye-orb svg {
		display: block;
		width: 100%;
		height: 100%;
		overflow: visible;
	}

	.demon-iris {
		transform-origin: center;
		animation: demon-pulse 3.8s ease-in-out infinite;
	}

	.demon-sheen {
		position: absolute;
		inset: 0;
		border-radius: 9999px;
		pointer-events: none;
		background: linear-gradient(
			105deg,
			transparent 38%,
			rgba(255, 255, 255, 0.32) 50%,
			transparent 62%
		);
		animation: demon-sheen 3.6s ease-in-out infinite;
		opacity: 0;
	}

	@keyframes demon-float {
		0%,
		100% {
			transform: translateY(0) scale(1);
		}
		50% {
			transform: translateY(-1.2px) scale(1.01);
		}
	}

	@keyframes demon-pulse {
		0%,
		100% {
			transform: scale(1);
		}
		50% {
			transform: scale(1.015);
		}
	}

	@keyframes demon-sheen {
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

	:global(.logo:hover) .demon-eye-float {
		animation-duration: 2s;
	}

	:global(.logo:hover) .demon-iris {
		animation-duration: 1.8s;
	}

	@media (prefers-reduced-motion: reduce) {
		.demon-eye-float,
		.demon-iris,
		.demon-sheen {
			animation: none;
		}

		:global(.logo:hover) .demon-eye-float,
		:global(.logo:hover) .demon-iris {
			animation: none;
		}
	}
</style>
