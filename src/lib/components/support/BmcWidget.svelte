<script lang="ts">
	import { onMount } from 'svelte';
	import { browser } from '$app/environment';

	// Official Buy Me a Coffee widget (HelpGavin), loaded once and never duplicated.
	// Attributes mirrored exactly from the official snippet — the widget
	// self-initializes from them. position/margins: bottom-right, 18px offsets.
	onMount(() => {
		if (!browser) return;
		if (document.querySelector('script[data-name="BMC-Widget"]')) return;
		const s = document.createElement('script');
		s.setAttribute('data-name', 'BMC-Widget');
		s.setAttribute('data-cfasync', 'false');
		s.src = 'https://cdnjs.buymeacoffee.com/1.0.0/widget.prod.min.js';
		s.setAttribute('data-id', 'HelpGavin');
		s.setAttribute('data-description', 'Support me on Buy me a coffee!');
		s.setAttribute('data-message', '');
		s.setAttribute('data-color', '#5F7FFF');
		s.setAttribute('data-position', 'Right');
		s.setAttribute('data-x_margin', '18');
		s.setAttribute('data-y_margin', '18');
		s.async = true;
		document.head.appendChild(s);
	});
</script>
