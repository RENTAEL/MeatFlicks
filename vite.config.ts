import dotenv from 'dotenv';
// Load .env before anything else so server modules validated at import time
// (config/env) see TMDB/Turso keys during vite dev and build.
dotenv.config();

import tailwindcss from '@tailwindcss/vite';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import path from 'path';

export default defineConfig({
	plugins: [tailwindcss(), sveltekit()],
	build: {
		cssCodeSplit: false
	},
	resolve: {
		alias: {
			$lib: path.resolve('./src/lib')
		}
	},
	server: {
		watch: {
			ignored: ['data/**', 'drizzle/**']
		}
	},
	ssr: {
		external: ['better-sqlite3', 'sqlite3', 'libsql', '@neon-rs/load']
	},
	test: {
		expect: { requireAssertions: true },
		projects: [
			{
				plugins: [sveltekit()],
				resolve: {
					alias: {
						$lib: path.resolve('./src/lib')
					}
				},
				test: {
					name: 'client',
					environment: 'browser',
					browser: {
						enabled: true,
						provider: 'playwright',
						instances: [{ browser: 'chromium' }]
					},
					include: ['src/**/*.svelte.{test,spec}.{js,ts}'],
					exclude: ['src/lib/server/**'],
					setupFiles: ['./vitest-setup-client.ts']
				}
			},
			{
				test: {
					name: 'server',
					environment: 'node',
					include: ['src/**/*.{test,spec}.{js,ts}'],
					exclude: ['src/**/*.svelte.{test,spec}.{js,ts}'],
					setupFiles: ['./vitest-setup-server.ts']
				}
			}
		]
	}
});
