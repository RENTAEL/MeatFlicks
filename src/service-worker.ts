/// <reference types="@sveltejs/kit" />

import { build, files, version } from '$service-worker';

const ASSETS_CACHE = `cache-${version}-branding-v3`;
const IMAGE_CACHE = 'images';

const toCache = build.concat(files);

self.addEventListener('install', (event) => {
	event.waitUntil(
		caches
			.open(ASSETS_CACHE)
			.then((cache) =>
				cache.addAll(toCache).catch((err) => {
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
						if (response.ok && toCache.includes(url.pathname)) {
							const clone = response.clone();
							caches.open(ASSETS_CACHE).then((cache) => cache.put(event.request, clone));
						}
						return response;
					})
					.catch(() => cached || new Response('', { status: 503 }))
		)
	);
});
