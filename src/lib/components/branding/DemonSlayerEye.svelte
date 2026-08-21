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
					<!-- Polished iris: deep abyss to flame core - refined, fewer stops -->
					<radialGradient id="demonIrisNew" cx="50%" cy="50%" r="52%">
						<stop offset="0%" stop-color="#0d0202" />
						<stop offset="22%" stop-color="#2a0a0a" />
						<stop offset="45%" stop-color="#7a1a1a" />
						<stop offset="68%" stop-color="#c81e1e" />
						<stop offset="85%" stop-color="#ff3b30" />
						<stop offset="100%" stop-color="#ff6b2b" />
					</radialGradient>
					<!-- Clean sclera: crisp white with subtle warm tint -->
					<radialGradient id="demonScleraNew" cx="38%" cy="32%" r="78%">
						<stop offset="0%" stop-color="#ffffff" />
						<stop offset="35%" stop-color="#fff5f0" />
						<stop offset="72%" stop-color="#ffe8e0" />
						<stop offset="100%" stop-color="#ffd0c2" />
					</radialGradient>
					<!-- Refined outer glow: tighter, more controlled -->
					<radialGradient id="demonGlowNew" cx="50%" cy="50%" r="68%">
						<stop offset="62%" stop-color="rgba(255,59,48,0)" />
						<stop offset="82%" stop-color="rgba(255,59,48,0.22)" />
						<stop offset="100%" stop-color="rgba(255,107,43,0.32)" />
					</radialGradient>
					<!-- Pupil: deep void with subtle red rim -->
					<linearGradient id="demonPupilNew" x1="50%" y1="0%" x2="50%" y2="100%">
						<stop offset="0%" stop-color="#050000" />
						<stop offset="50%" stop-color="#000000" />
						<stop offset="100%" stop-color="#0a0000" />
					</linearGradient>
					<!-- Inner iris highlight for 3D depth -->
					<radialGradient id="demonIrisHighlight" cx="35%" cy="28%" r="45%">
						<stop offset="0%" stop-color="rgba(255,255,255,0.22)" />
						<stop offset="100%" stop-color="rgba(255,255,255,0)" />
					</radialGradient>
					<filter id="demonShadowNew" x="-40%" y="-40%" width="180%" height="180%">
						<feDropShadow
							dx="0"
							dy="1"
							stdDeviation="0.9"
							flood-color="#000"
							flood-opacity="0.45"
						/>
					</filter>
				</defs>

				<!-- Subtle outer glow - tighter, not bloated -->
				<ellipse cx="12" cy="12" rx="10.2" ry="6.8" fill="url(#demonGlowNew)" opacity="0.85" />

				<!-- Eye sclera - refined proportions, less flat (more natural 0.62 ratio) -->
				<g filter="url(#demonShadowNew)">
					<path
						d="M3.1 12 C 6.4 6.1 17.6 6.1 20.9 12 C 17.6 17.9 6.4 17.9 3.1 12 Z"
						fill="url(#demonScleraNew)"
						stroke="rgba(90,15,15,0.28)"
						stroke-width="0.35"
					/>
				</g>

				<!-- Iris - better proportion: 5.4 radius (was 6.2, too large), leaves more sclera -->
				<g class="demon-iris">
					<circle cx="12" cy="12" r="5.4" fill="url(#demonIrisNew)" />
					<!-- Single subtle ring for texture (was two, too busy at small sizes) -->
					<circle
						cx="12"
						cy="12"
						r="4.2"
						fill="none"
						stroke="rgba(255,180,140,0.14)"
						stroke-width="0.28"
					/>
					<!-- Iris highlight for 3D depth - large soft highlight -->
					<ellipse
						cx="12"
						cy="12"
						rx="5.4"
						ry="5.4"
						fill="url(#demonIrisHighlight)"
						opacity="0.9"
					/>
				</g>

				<!-- Vertical slit pupil - refined: slightly wider for better read at small sizes, perfect proportions -->
				<ellipse
					cx="12"
					cy="12"
					rx="0.95"
					ry="3.9"
					fill="url(#demonPupilNew)"
					stroke="rgba(255,55,25,0.5)"
					stroke-width="0.28"
				/>
				<!-- Pupil depth - inner dark core -->
				<ellipse cx="12" cy="12" rx="0.42" ry="3.1" fill="#000000" />
				<!-- Pupil vertical highlight - subtle 3D -->
				<rect x="11.82" y="8.6" width="0.36" height="6.8" rx="0.18" fill="rgba(255,255,255,0.10)" />

				<!-- Catchlights - refined: one primary, one secondary, better positioned for 3D -->
				<ellipse cx="10.1" cy="9.2" rx="0.95" ry="0.78" fill="white" opacity="0.88" />
				<ellipse cx="10.25" cy="9.35" rx="0.32" ry="0.26" fill="white" opacity="0.45" />
				<ellipse cx="14.6" cy="14.9" rx="0.38" ry="0.30" fill="white" opacity="0.22" />

				<!-- Eyelid definition - subtle, not heavy -->
				<!-- Top lid: gentle shadow -->
				<path
					d="M3.1 12 C 6.4 6.1 17.6 6.1 20.9 12 C 20.2 10.6 18.6 8.9 16.2 7.7 C 14.0 6.6 10.0 6.6 7.8 7.7 C 5.4 8.9 3.8 10.6 3.1 12"
					fill="rgba(0,0,0,0.14)"
				/>
				<!-- Top lid edge - crisp line -->
				<path
					d="M3.1 12 C 6.4 6.1 17.6 6.1 20.9 12"
					fill="none"
					stroke="rgba(60,10,10,0.22)"
					stroke-width="0.45"
					stroke-linecap="round"
				/>
				<!-- Bottom lid: subtle highlight -->
				<path
					d="M3.1 12 C 6.4 17.9 17.6 17.9 20.9 12 C 20.2 13.2 18.7 14.6 16.4 15.6 C 14.2 16.5 9.8 16.5 7.6 15.6 C 5.3 14.6 3.8 13.2 3.1 12"
					fill="rgba(255,210,190,0.08)"
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
		filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.5)) drop-shadow(0 0 6px rgba(255, 59, 48, 0.38))
			drop-shadow(0 0 12px rgba(255, 107, 43, 0.18));
	}

	.demon-eye-float {
		width: 100%;
		height: 100%;
		will-change: transform;
		animation: demon-float 5s ease-in-out infinite;
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
		animation: demon-pulse 4s ease-in-out infinite;
	}

	.demon-sheen {
		position: absolute;
		inset: 0;
		border-radius: 9999px;
		pointer-events: none;
		background: linear-gradient(
			105deg,
			transparent 36%,
			rgba(255, 255, 255, 0.28) 50%,
			transparent 64%
		);
		animation: demon-sheen 4s ease-in-out infinite;
		opacity: 0;
	}

	@keyframes demon-float {
		0%,
		100% {
			transform: translateY(0);
		}
		50% {
			transform: translateY(-0.8px);
		}
	}

	@keyframes demon-pulse {
		0%,
		100% {
			transform: scale(1);
		}
		50% {
			transform: scale(1.008);
		}
	}

	@keyframes demon-sheen {
		0% {
			transform: translateX(-125%);
			opacity: 0;
		}
		40% {
			opacity: 1;
		}
		60%,
		100% {
			transform: translateX(125%);
			opacity: 0;
		}
	}

	:global(.logo:hover) .demon-eye-float {
		animation-duration: 2.2s;
	}

	@media (prefers-reduced-motion: reduce) {
		.demon-eye-float,
		.demon-iris,
		.demon-sheen {
			animation: none;
		}

		:global(.logo:hover) .demon-eye-float {
			animation: none;
		}
	}
</style>
