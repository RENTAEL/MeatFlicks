<script lang="ts">
	// Dismiss control for the official BMC widget. In-memory state ONLY —
	// no localStorage/sessionStorage/cookies, so the widget always returns
	// on page refresh. Hides the injected #bmc-wbtn via a body class.
	let dismissed = $state(false);

	function dismiss() {
		dismissed = true;
		document.body.classList.add('bmc-hidden');
	}
</script>

{#if !dismissed}
	<button
		type="button"
		class="bmc-dismiss"
		aria-label="Dismiss support button"
		title="Dismiss"
		onclick={dismiss}
	>
		<svg
			width="10"
			height="10"
			viewBox="0 0 10 10"
			fill="none"
			stroke="currentColor"
			stroke-width="1.6"
			stroke-linecap="round"
			aria-hidden="true"
		>
			<line x1="1.5" y1="1.5" x2="8.5" y2="8.5" />
			<line x1="8.5" y1="1.5" x2="1.5" y2="8.5" />
		</svg>
	</button>
{/if}

<style>
	.bmc-dismiss {
		position: fixed;
		right: 30px;
		bottom: 224px;
		z-index: 1200;
		display: flex;
		align-items: center;
		justify-content: center;
		width: 20px;
		height: 20px;
		border-radius: 999px;
		background: #140d12;
		color: #c9b3bc;
		border: 1px solid rgba(212, 175, 55, 0.28);
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.4);
		cursor: pointer;
		transition:
			color 0.2s ease,
			border-color 0.2s ease,
			box-shadow 0.2s ease;
	}

	.bmc-dismiss:hover {
		color: #e0576f;
		border-color: rgba(142, 29, 46, 0.6);
		box-shadow: 0 2px 10px rgba(0, 0, 0, 0.45), 0 0 10px rgba(142, 29, 46, 0.25);
	}

	.bmc-dismiss:focus-visible {
		outline: 2px solid rgba(212, 175, 55, 0.9);
		outline-offset: 2px;
	}

	/* Hide the official widget (and this button is unmounted) once dismissed */
	:global(body.bmc-hidden #bmc-wbtn) {
		display: none !important;
	}

	@media (max-width: 768px) {
		.bmc-dismiss {
			right: 22px;
			bottom: 202px;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.bmc-dismiss {
			transition: none;
		}
	}
</style>
