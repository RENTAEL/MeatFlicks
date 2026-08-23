import adapter from '@sveltejs/adapter-auto';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	preprocess: vitePreprocess(),
	kit: {
		// Detects Vercel AND Netlify at build time (NETLIFY/VERCEL env vars).
		adapter: adapter(),
		alias: {
			'@': './src',
			types: '$lib/types'
		},
		csrf: {
			checkOrigin: false
		},
		paths: {
			relative: false
		}
	}
};

export default config;
