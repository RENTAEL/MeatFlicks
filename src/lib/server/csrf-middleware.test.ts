import { describe, expect, it } from 'vitest';
import type { RequestEvent } from '@sveltejs/kit';
import { csrfMiddleware, generateSecureCsrfToken } from './csrf';

const CSRF_COOKIE_NAME = 'csrf_token';
const ROTATION_INTERVAL_MS = 4 * 60 * 60 * 1000;
const EXPIRY_MS = 24 * 60 * 60 * 1000;

/**
 * Minimal RequestEvent stand-in. `cookies.get` returns the most recently set
 * value, matching SvelteKit's read-your-writes behaviour — that detail is the
 * whole point of the rotation test below.
 */
function makeEvent(opts: {
	path: string;
	method?: string;
	cookie?: string | null;
	headerToken?: string | null;
}) {
	const jar = new Map<string, string>();
	if (opts.cookie) jar.set(CSRF_COOKIE_NAME, opts.cookie);

	const headers = new Headers();
	if (opts.headerToken) headers.set('x-csrf-token', opts.headerToken);

	const event = {
		url: new URL(`https://example.test${opts.path}`),
		request: new Request(`https://example.test${opts.path}`, {
			method: opts.method ?? 'GET',
			headers
		}),
		cookies: {
			get: (name: string) => jar.get(name),
			set: (name: string, value: string) => jar.set(name, value),
			delete: (name: string) => jar.delete(name)
		}
	} as unknown as RequestEvent;

	return { event, jar };
}

const resolve = async () => new Response('ok', { status: 200 });

function cookieValue(ageMs: number) {
	const data = generateSecureCsrfToken();
	// Rebuild `expires` so the token reads as `ageMs` old.
	return { ...data, expires: Date.now() + EXPIRY_MS - ageMs };
}

describe('csrfMiddleware().handle', () => {
	it('rejects a non-API POST whose token does not match the cookie', async () => {
		const data = cookieValue(0);
		const { event } = makeEvent({
			path: '/profile',
			method: 'POST',
			cookie: JSON.stringify(data),
			headerToken: 'not-the-right-token'
		});

		const res = await csrfMiddleware().handle({ event, resolve });

		expect(res.status).toBe(403);
	});

	it('accepts a non-API POST whose token matches the cookie', async () => {
		const data = cookieValue(0);
		const { event } = makeEvent({
			path: '/profile',
			method: 'POST',
			cookie: JSON.stringify(data),
			headerToken: data.token
		});

		const res = await csrfMiddleware().handle({ event, resolve });

		expect(res.status).toBe(200);
	});

	it('exempts /login from CSRF validation', async () => {
		const { event } = makeEvent({ path: '/login', method: 'POST', cookie: null });

		const res = await csrfMiddleware().handle({ event, resolve });

		expect(res.status).toBe(200);
	});

	it('does not validate CSRF on API routes at all', async () => {
		// Documents an existing gap rather than endorsing it: the `!isApiRequest`
		// guard means mutating API routes rely on SameSite=Lax alone.
		const { event } = makeEvent({
			path: '/api/watchlist',
			method: 'POST',
			cookie: null,
			headerToken: null
		});

		const res = await csrfMiddleware().handle({ event, resolve });

		expect(res.status).toBe(200);
	});

	it('lets GETs through without a token and mints a cookie for a fresh visitor', async () => {
		const { event, jar } = makeEvent({ path: '/profile', method: 'GET', cookie: null });

		const res = await csrfMiddleware().handle({ event, resolve });

		expect(res.status).toBe(200);
		expect(jar.get(CSRF_COOKIE_NAME)).toBeDefined();
	});

	it('accepts a valid POST even when the cookie is old enough to rotate', async () => {
		// Regression guard. Rotation fires once a token is within ROTATION_INTERVAL
		// of its expiry — i.e. older than EXPIRY - ROTATION = 20h. If rotation runs
		// before validation, the freshly written cookie is compared against the
		// still-valid token the form submitted, and a legitimate request is
		// rejected with a spurious 403.
		const data = cookieValue(EXPIRY_MS - ROTATION_INTERVAL_MS + 60_000);
		const { event, jar } = makeEvent({
			path: '/profile',
			method: 'POST',
			cookie: JSON.stringify(data),
			headerToken: data.token
		});

		const res = await csrfMiddleware().handle({ event, resolve });

		expect(res.status).toBe(200);
		// And it should still have rotated, so the next request gets a fresh token.
		expect(jar.get(CSRF_COOKIE_NAME)).not.toBe(JSON.stringify(data));
	});
});
