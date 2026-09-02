/// <reference types="@sveltejs/kit" />

import { build, files, version } from '$service-worker';

const ASSETS_CACHE = `cache-${version}-branding-v3`;
const IMAGE_CACHE = 'images';

// Precache the app shell only, not every build asset and static file.
// Precaching all of them cost ~1.4MB on a visitor's very first request, and
// most of that was never used by the homepage (the lazy-loaded Firebase chunk,
// the /sounds/*.mp3 files, route chunks for pages nobody had visited yet).
// Worse, ASSETS_CACHE is keyed on the build `version`, so every deploy
// invalidated the whole cache and made every returning visitor re-download all
// of it. Anything left out of the shell is still cached on demand by the fetch
// handler below, so this trades a large upfront cost for lazy population.
const IMMUTABLE_PREFIX = '/_app/immutable/';

const shellBuild = build.filter(
	(path) =>
		path.includes('/immutable/entry/') ||
		path.includes('/immutable/nodes/0') ||
		path.includes('/immutable/nodes/2') ||
		path.includes('/immutable/nodes/4') ||
		path.endsWith('.css')
);

// Static files: only tiny essentials. Never the audio, which is large and
// only needed once the user actually triggers a sound.
const shellFiles = files.filter((path) => {
	if (path.includes('/sounds/') || path.endsWith('.mp3')) return false;
	return path.endsWith('/manifest.json') || /(favicon|icon)/i.test(path);
});

const shell = shellBuild.concat(shellFiles);

self.addEventListener('install', (event) => {
	event.waitUntil(
		caches
			.open(ASSETS_CACHE)
			.then((cache) =>
				cache.addAll(shell).catch((err) => {
					console.warn('SW: Failed to cache some assets:', err.message);
				})
			)
			.then(() => {
				(self as any).skipWaiting();
			})
	);
});

self.addEventListener('activate', (event) => {
	event.waitUntil(
		caches
			.keys()
			.then((keys) => {
				return Promise.all(
					keys
						.filter((key) => key !== ASSETS_CACHE && key !== IMAGE_CACHE)
						.map((key) => caches.delete(key))
				);
			})
			.then(() => (self as any).clients.claim().catch(() => {}))
	);
});

self.addEventListener('fetch', (event) => {
	if (event.request.method !== 'GET') return;
	if (!event.request.url.startsWith(self.location.origin)) return;

	const url = new URL(event.request.url);

	// Document navigations must be network-first: the HTML is per-user (session
	// cookie is read during SSR), so a cached page would serve stale logged-out
	// markup. Fall back to the cache only when offline.
	if (event.request.mode === 'navigate') {
		event.respondWith(
			fetch(event.request)
				.then((response) => {
					if (response.ok) {
						const clone = response.clone();
						caches.open(ASSETS_CACHE).then((cache) => cache.put(event.request, clone));
					}
					return response;
				})
				.catch(() => caches.match(event.request))
		);
		return;
	}

	if (url.hostname === 'image.tmdb.org') {
		event.respondWith(
			caches.open(IMAGE_CACHE).then((cache) =>
				cache.match(event.request).then(
					(cached) =>
						cached ||
						fetch(event.request)
							.then((response) => {
								if (response.ok) {
									cache.put(event.request, response.clone());
								}
								return response;
							})
							.catch(() => cached || new Response('', { status: 503 }))
				)
			)
		);
		return;
	}

	if (url.pathname.startsWith('/api/')) {
		event.respondWith(
			fetch(event.request).catch(() =>
				caches.match('/').catch(() => new Response('Offline', { status: 503 }))
			)
		);
		return;
	}

	event.respondWith(
		caches.match(event.request).then(
			(cached) =>
				cached ||
				fetch(event.request)
					.then((response) => {
						// Runtime caching has to cover everything the shrunken precache no
						// longer covers: every hashed immutable build asset is safe to keep
						// forever, so cache it the first time it is actually requested.
						if (
							response.ok &&
							(url.pathname.startsWith(IMMUTABLE_PREFIX) || shell.includes(url.pathname))
						) {
							const clone = response.clone();
							caches.open(ASSETS_CACHE).then((cache) => cache.put(event.request, clone));
						}
						return response;
					})
					.catch(() => cached || new Response('', { status: 503 }))
		)
	);
});
