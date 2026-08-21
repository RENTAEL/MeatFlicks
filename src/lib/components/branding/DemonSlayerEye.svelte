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
					<!-- Outer badge: deep abyss night -->
					<radialGradient id="demonBadgeNew" cx="50%" cy="38%" r="78%">
						<stop offset="0%" stop-color="#1e1218" />
						<stop offset="45%" stop-color="#0f0a0f" />
						<stop offset="100%" stop-color="#050308" />
					</radialGradient>
					<!-- Iris: Demon Slayer flame - deep to inferno, with hashira intensity -->
					<radialGradient id="demonIrisFinal" cx="50%" cy="50%" r="56%">
						<stop offset="0%" stop-color="#080202" />
						<stop offset="16%" stop-color="#1a0505" />
						<stop offset="32%" stop-color="#4a0a0a" />
						<stop offset="52%" stop-color="#8a1a1a" />
						<stop offset="71%" stop-color="#d9251a" />
						<stop offset="86%" stop-color="#ff3b1a" />
						<stop offset="100%" stop-color="#ff7a15" />
					</radialGradient>
					<!-- Sclera: pearl with demon blush - crisp, premium -->
					<radialGradient id="demonScleraFinal" cx="36%" cy="30%" r="80%">
						<stop offset="0%" stop-color="#ffffff" />
						<stop offset="32%" stop-color="#fff8f3" />
						<stop offset="62%" stop-color="#ffe9e0" />
						<stop offset="88%" stop-color="#ffd8cc" />
						<stop offset="100%" stop-color="#ffb8a8" />
					</radialGradient>
					<!-- Cornea depth: subtle inset -->
					<radialGradient id="demonCornea" cx="35%" cy="28%" r="52%">
						<stop offset="0%" stop-color="rgba(255,255,255,0.26)" />
						<stop offset="100%" stop-color="rgba(255,255,255,0)" />
					</radialGradient>
					<!-- Pupil: abyssal void -->
					<linearGradient id="demonPupilFinal" x1="50%" y1="0%" x2="50%" y2="100%">
						<stop offset="0%" stop-color="#020000" />
						<stop offset="50%" stop-color="#000000" />
						<stop offset="100%" stop-color="#0a0000" />
					</linearGradient>
					<!-- Flame outer aura -->
					<radialGradient id="demonAura" cx="50%" cy="50%" r="72%">
						<stop offset="58%" stop-color="rgba(255,42,18,0)" />
						<stop offset="78%" stop-color="rgba(255,42,18,0.18)" />
						<stop offset="92%" stop-color="rgba(255,100,15,0.28)" />
						<stop offset="100%" stop-color="rgba(255,160,0,0.0)" />
					</radialGradient>
					<!-- Iris flame pattern overlay -->
					<radialGradient id="demonFlamePattern" cx="50%" cy="50%" r="60%">
						<stop offset="48%" stop-color="rgba(0,0,0,0)" />
						<stop offset="72%" stop-color="rgba(255,80,20,0.0)" />
						<stop offset="100%" stop-color="rgba(255,60,20,0.12)" />
					</radialGradient>
					<filter id="demonShadowFinal" x="-45%" y="-45%" width="190%" height="190%">
						<feDropShadow
							dx="0"
							dy="1.2"
							stdDeviation="1"
							flood-color="#000"
							flood-opacity="0.52"
						/>
					</filter>
					<filter id="demonInnerShadow" x="-20%" y="-20%" width="140%" height="140%">
						<feOffset dx="0" dy="0.6" />
						<feGaussianBlur stdDeviation="0.7" />
						<feComposite operator="out" in2="SourceGraphic" />
						<feColorMatrix values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.32 0" />
						<feBlend in="SourceGraphic" />
					</filter>
				</defs>

				<!-- Outer badge - 3D circular base like other logos, but demon night -->
				<circle
					cx="12"
					cy="12"
					r="11.2"
					fill="url(#demonBadgeNew)"
					stroke="rgba(255,42,18,0.22)"
					stroke-width="0.55"
				/>
				<circle
					cx="12"
					cy="12"
					r="11.2"
					fill="none"
					stroke="rgba(255,255,255,0.06)"
					stroke-width="0.35"
				/>

				<!-- Aura glow -->
				<ellipse cx="12" cy="12" rx="11.6" ry="8.4" fill="url(#demonAura)" opacity="0.95" />

				<!-- Eye socket depth - subtle inset -->
				<ellipse cx="12" cy="12" rx="9.2" ry="6.4" fill="rgba(0,0,0,0.22)" opacity="0.9" />

				<!-- Sclera - refined eye shape, not too flat, proper almond with human elegance -->
				<g filter="url(#demonShadowFinal)">
					<path
						d="M3.4 12 C 6.1 6.6 17.9 6.6 20.6 12 C 17.9 17.4 6.1 17.4 3.4 12 Z"
						fill="url(#demonScleraFinal)"
						stroke="rgba(80,12,12,0.20)"
						stroke-width="0.28"
					/>
					<!-- Sclera veins - demon subtle, only at corners for small-size clarity -->
					<path
						d="M4.8 11.2 C 5.6 10.8 6.4 10.6 7.1 10.9"
						stroke="rgba(180,30,30,0.18)"
						stroke-width="0.22"
						stroke-linecap="round"
						fill="none"
					/>
					<path
						d="M16.9 10.9 C 17.6 10.6 18.4 10.8 19.2 11.2"
						stroke="rgba(180,30,30,0.18)"
						stroke-width="0.22"
						stroke-linecap="round"
						fill="none"
					/>
					<path
						d="M4.9 13.0 C 5.7 13.3 6.5 13.4 7.2 13.1"
						stroke="rgba(180,30,30,0.12)"
						stroke-width="0.18"
						stroke-linecap="round"
						fill="none"
					/>
				</g>

				<!-- Iris - perfectly centered, bold 3D with flame soul -->
				<g class="demon-iris">
					<!-- Iris base with depth -->
					<circle cx="12" cy="12" r="5.15" fill="url(#demonIrisFinal)" />
					<!-- Iris outer ring - depth edge -->
					<circle
						cx="12"
						cy="12"
						r="5.15"
						fill="none"
						stroke="rgba(0,0,0,0.32)"
						stroke-width="0.42"
					/>
					<!-- Inner tuft pattern - subtle flame wisps (Demon Slayer hashira like) -->
					<circle
						cx="12"
						cy="12"
						r="3.9"
						fill="none"
						stroke="rgba(255,140,60,0.13)"
						stroke-width="0.24"
						stroke-dasharray="0.9 1.6"
						opacity="0.9"
					/>
					<!-- Cornea bulge - 3D highlight makes it read as wet, curved -->
					<ellipse cx="12" cy="12" rx="5.15" ry="5.15" fill="url(#demonCornea)" />
					<!-- Flame pattern overlay - very subtle, only visible up close, keeps crisp at small -->
					<g opacity="0.32">
						<path
							d="M12 7.1 C 11.2 8.4 11.0 9.9 12 11.2 C 13.0 9.9 12.8 8.4 12 7.1"
							fill="rgba(255,80,20,0.16)"
						/>
						<path
							d="M12 16.9 C 11.2 15.6 11.0 14.1 12 12.8 C 13.0 14.1 12.8 15.6 12 16.9"
							fill="rgba(90,10,10,0.20)"
						/>
					</g>
				</g>

				<!-- Vertical slit pupil - Demon Slayer iconic, razor sharp with pointed ends -->
				<path
					d="M12 7.05 C 11.18 8.55 11.02 10.15 11.06 12 C 11.02 13.85 11.18 15.45 12 16.95 C 12.82 15.45 12.98 13.85 12.94 12 C 12.98 10.15 12.82 8.55 12 7.05 Z"
					fill="url(#demonPupilFinal)"
					stroke="rgba(255,50,18,0.62)"
					stroke-width="0.32"
					stroke-linejoin="round"
				/>
				<!-- Pupil core - absolute void -->
				<path
					d="M12 7.8 C 11.42 8.95 11.32 10.3 11.34 12 C 11.32 13.7 11.42 15.05 12 16.2 C 12.58 15.05 12.68 13.7 12.66 12 C 12.68 10.3 12.58 8.95 12 7.8 Z"
					fill="#000000"
				/>
				<!-- Pupil edge glow - thin line for 3D rim -->
				<path
					d="M12 7.05 C 11.18 8.55 11.02 10.15 11.06 12 C 11.02 13.85 11.18 15.45 12 16.95"
					fill="none"
					stroke="rgba(255,255,255,0.07)"
					stroke-width="0.22"
					stroke-linecap="round"
				/>

				<!-- Specular highlights - 3D wet eye, premium -->
				<!-- Primary large highlight - cornea -->
				<ellipse cx="10.05" cy="9.55" rx="1.02" ry="0.82" fill="white" opacity="0.94" />
				<ellipse cx="9.92" cy="9.42" rx="0.34" ry="0.26" fill="white" opacity="0.52" />
				<!-- Secondary micro highlight - opposite for depth -->
				<ellipse cx="14.75" cy="14.85" rx="0.32" ry="0.24" fill="white" opacity="0.20" />
				<!-- Iris rim highlight - subtle 3D edge -->
				<path
					d="M7.4 9.2 A 5.15 5.15 0 0 1 9.8 7.6"
					fill="none"
					stroke="rgba(255,255,255,0.14)"
					stroke-width="0.35"
					stroke-linecap="round"
				/>

				<!-- Eyelids - crafted for 3D, not flat -->
				<!-- Upper lid: thickness and shadow -->
				<path
					d="M3.4 12 C 6.1 6.6 17.9 6.6 20.6 12 C 19.9 10.9 18.4 9.2 16.1 8.1 C 13.9 7.0 10.1 7.0 7.9 8.1 C 5.6 9.2 4.1 10.9 3.4 12"
					fill="rgba(0,0,0,0.16)"
				/>
				<path
					d="M3.4 12 C 6.1 6.6 17.9 6.6 20.6 12"
					fill="none"
					stroke="rgba(25,5,5,0.32)"
					stroke-width="0.52"
					stroke-linecap="round"
				/>
				<!-- Upper lash line - subtle, crisp -->
				<path
					d="M3.4 12 C 6.1 6.6 17.9 6.6 20.6 12"
					fill="none"
					stroke="rgba(10,2,2,0.55)"
					stroke-width="0.22"
					stroke-linecap="round"
					opacity="0.9"
				/>
				<!-- Lower lid: soft highlight, clean -->
				<path
					d="M3.4 12 C 6.1 17.4 17.9 17.4 20.6 12 C 19.9 13.0 18.5 14.4 16.3 15.3 C 14.2 16.1 9.8 16.1 7.7 15.3 C 5.5 14.4 4.1 13.0 3.4 12"
					fill="rgba(255,225,205,0.07)"
				/>
				<path
					d="M3.4 12 C 6.1 17.4 17.9 17.4 20.6 12"
					fill="none"
					stroke="rgba(255,255,255,0.08)"
					stroke-width="0.28"
					stroke-linecap="round"
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
		filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.55)) drop-shadow(0 0 7px rgba(255, 42, 18, 0.42))
			drop-shadow(0 0 16px rgba(255, 100, 15, 0.16));
	}

	.demon-eye-float {
		width: 100%;
		height: 100%;
		will-change: transform;
		animation: demon-float 5.2s ease-in-out infinite;
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
		animation: demon-pulse 4.2s ease-in-out infinite;
	}

	.demon-sheen {
		position: absolute;
		inset: 0;
		border-radius: 9999px;
		pointer-events: none;
		background: linear-gradient(
			105deg,
			transparent 38%,
			rgba(255, 255, 255, 0.26) 50%,
			transparent 62%
		);
		animation: demon-sheen 4.2s ease-in-out infinite;
		opacity: 0;
	}

	@keyframes demon-float {
		0%,
		100% {
			transform: translateY(0);
		}
		50% {
			transform: translateY(-0.7px);
		}
	}

	@keyframes demon-pulse {
		0%,
		100% {
			transform: scale(1);
		}
		50% {
			transform: scale(1.006);
		}
	}

	@keyframes demon-sheen {
		0% {
			transform: translateX(-128%);
			opacity: 0;
		}
		42% {
			opacity: 1;
		}
		62%,
		100% {
			transform: translateX(128%);
			opacity: 0;
		}
	}

	:global(.logo:hover) .demon-eye-float {
		animation-duration: 2.4s;
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
