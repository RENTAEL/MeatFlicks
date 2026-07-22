import '../app.css';
import { browser } from '$app/environment';

if (browser) {
	import('svelte-match-media').then(({ setup }) => {
		setup({
			desktop: 'screen and (min-width: 768px)',
			mobile: 'screen and (max-width: 767px)'
		});
	});
}
