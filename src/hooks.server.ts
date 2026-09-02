import dotenv from 'dotenv';
dotenv.config();

import type { Handle, RequestEvent } from '@sveltejs/kit';
import { validateApiKeys, runMaintenance } from '$lib/server';
import { logger } from '$lib/server/logger';
import { recordServerError } from '$lib/server/admin/service';
import { apiRateLimiter, authRateLimiter } from '$lib/server/rate-limiter';
import { applySecurityHeaders } from '$lib/server/security-headers';
import { csrfMiddleware } from '$lib/server/csrf';
import {
	decryptSession,
	createSessionCookieName,
	getSessionCookieOptions
} from '$lib/server/session-crypto';
import { isUserSessionRevoked } from '$lib/server/session-revocation';
import { WATCH_PARTY_ENABLED } from '$lib/config/watchParty';
import { recordRequest } from '$lib/server/usage';
import { isPrivateApiPath, privateCacheControl } from '$lib/server/caching';

declare global {
	var __envValidated: boolean;
}

function getClientIp(event: RequestEvent): string {
	const headers = event.request.headers;
	const forwarded = headers.get('x-forwarded-for');
	if (forwarded) {
		return forwarded.split(',')[0].trim();
	}
	return (
		headers.get('cf-connecting-ip') ||
		headers.get('x-real-ip') ||
		event.getClientAddress() ||
		'unknown'
	);
}

async function validateSession(event: RequestEvent) {
	try {
		if (!event.locals.session) {
			return;
		}

		const session = event.locals.session;
		if (session.expiresAt && Date.now() > session.expiresAt.getTime()) {
			logger.warn(`Expired session detected for user ${session.userId}`);
			event.locals.session = null;
			event.locals.user = null;
		}
	} catch (error) {
		logger.error({ error }, 'Session validation failed');
	}
}

async function applyRateLimiting(event: RequestEvent) {
	const path = event.url.pathname;
	const ip = getClientIp(event);

	if (path.startsWith('/health') || path.startsWith('/static/') || path.startsWith('/favicon')) {
		return;
	}

	if (path.startsWith('/auth/') || path.startsWith('/login') || path.startsWith('/signup')) {
		const result = await authRateLimiter.checkLimit(`auth:${ip}`);
		if (!result.allowed) {
			logger.warn(`Rate limit exceeded for auth endpoint from IP: ${ip}`);
			return new Response('Too many requests. Please try again later.', {
				status: 429,
				headers: {
					'Retry-After': Math.ceil((result.resetTime! - Date.now()) / 1000).toString(),
					'X-RateLimit-Limit': result.limit?.toString() || '10',
					'X-RateLimit-Remaining': '0',
					'X-RateLimit-Reset': Math.ceil((result.resetTime! - Date.now()) / 1000).toString()
				}
			});
		}
	} else if (path.startsWith('/api/')) {
		const result = await apiRateLimiter.checkLimit(`api:${ip}`);
		if (!result.allowed) {
			logger.warn(`Rate limit exceeded for API endpoint from IP: ${ip}`);
			return new Response('Too many requests. Please try again later.', {
				status: 429,
				headers: {
					'Retry-After': Math.ceil((result.resetTime! - Date.now()) / 1000).toString(),
					'X-RateLimit-Limit': result.limit?.toString() || '100',
					'X-RateLimit-Remaining': '0',
					'X-RateLimit-Reset': Math.ceil((result.resetTime! - Date.now()) / 1000).toString()
				}
			});
		}
	}
}

// REPORT-ONLY ON PURPOSE — DO NOT PROMOTE THIS TO AN ENFORCING
// `Content-Security-Policy` UNTIL IT HAS BEEN OBSERVED IN PRODUCTION.
//
// The site's core function is a third-party video player embedded from vidlink.pro (plus
// youtube-nocookie.com embeds), so an enforcing policy that is even slightly too narrow
// takes playback down. Ship this, watch real traffic, then enforce.
//
// `frame-src` IS THE DIRECTIVE TO VERIFY FIRST: it governs the player iframe, it is the
// one most likely to be incomplete (providers are swapped/added in $lib/providers), and
// it is the one whose failure breaks the product rather than degrading it.
//
// Note there is no report-uri/report-to endpoint configured, so violations surface only
// in the browser console — check a real playback session in devtools before enforcing.
const CSP_REPORT_ONLY = `
	default-src 'self';
	base-uri 'self';
	object-src 'none';
	form-action 'self';
	frame-ancestors 'self';
	script-src 'self' 'unsafe-inline' 'unsafe-eval' blob:;
	style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
	font-src 'self' data: https://fonts.gstatic.com;
	img-src 'self' data: blob: https://image.tmdb.org https://i.ytimg.com;
	media-src 'self' blob: data: https:;
	connect-src 'self' https: wss:;
	frame-src 'self' https://vidlink.pro https://vidsrc.to https://vidsrc.xyz https://2embed.cc https://www.youtube-nocookie.com https://youtube-nocookie.com https://www.youtube.com https://youtube.com;
	worker-src 'self' blob:;
	manifest-src 'self'
`
	.replace(/\s+/g, ' ')
	.trim();

// `fullscreen=*` is preserved deliberately: the player runs in a cross-origin iframe that
// declares allow="autoplay; fullscreen; encrypted-media; ...", and dropping it would break
// the fullscreen control. Features not named here (autoplay, encrypted-media,
// picture-in-picture, accelerometer, gyroscope) keep their browser defaults, unchanged.
const PERMISSIONS_POLICY =
	'camera=(), microphone=(), geolocation=(), interest-cohort=(), fullscreen=*';

function finalizeResponse(event: RequestEvent, response: Response): Response {
	// Mutated in place rather than rebuilt via `new Response(response.body, ...)` so that
	// streaming responses (e.g. the SSE presence stream) are not disturbed.
	response.headers.set('X-Content-Type-Options', 'nosniff');
	response.headers.set('X-Frame-Options', 'SAMEORIGIN');
	response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');

	response.headers.delete('Permissions-Policy');
	response.headers.delete('permissions-policy');
	response.headers.delete('Feature-Policy');
	response.headers.set('Permissions-Policy', PERMISSIONS_POLICY);

	// Guard against an enforcing CSP arriving from anywhere else in the stack.
	response.headers.delete('Content-Security-Policy');
	response.headers.set('Content-Security-Policy-Report-Only', CSP_REPORT_ONLY);

	// Per-user payloads must never sit in Vercel's shared edge cache. Without this these
	// routes inherit Vercel's default `public, max-age=0, must-revalidate` with no Vary.
	if (isPrivateApiPath(event.url.pathname)) {
		response.headers.set('Cache-Control', privateCacheControl());
		response.headers.set('Vary', 'Cookie');
	}

	return response;
}

export const handle: Handle = async ({ event, resolve }) => {
	// Watch Party kill switch — reject before ANY session/CSRF/rate-limit
	// work so a disabled feature costs zero server CPU. Stale open tabs
	// polling old URLs hit this wall instead of the DB-backed handlers.
	if (!WATCH_PARTY_ENABLED && event.url.pathname.startsWith('/api/watch-party')) {
		return finalizeResponse(
			event,
			new Response(JSON.stringify({ ok: false, error: 'Watch Party is temporarily disabled' }), {
				status: 503,
				headers: { 'content-type': 'application/json', 'retry-after': '3600' }
			})
		);
	}

	if (!globalThis.__envValidated) {
		try {
			validateApiKeys();
			globalThis.__envValidated = true;
			logger.info('Environment validation completed successfully');
		} catch (error) {
			logger.error({ error }, 'Environment validation failed');
			if (process.env.NODE_ENV === 'production') {
				return finalizeResponse(
					event,
					new Response('Server configuration error', { status: 500 })
				);
			}
			logger.warn('Running with invalid API keys in development mode');
		}
	}

	const raw = event.cookies.get(createSessionCookieName());
	let sessionData = raw ? decryptSession(raw) : null;
	if (sessionData) {
		try {
			const revoked = await isUserSessionRevoked(sessionData.userId, sessionData.issuedAt ?? 0);
			if (revoked) {
				// Admin ended this session — treat as logged out and drop the stale cookie.
				sessionData = null;
				event.cookies.delete(createSessionCookieName(), getSessionCookieOptions());
			}
		} catch {
			// revocation check is best-effort; expiry still applies below
		}
	}
	if (sessionData) {
		event.locals.user = {
			id: sessionData.userId,
			username: sessionData.username,
			role: sessionData.role
		};
		event.locals.session = {
			id: createSessionCookieName(),
			userId: sessionData.userId,
			expiresAt: new Date(sessionData.expiresAt)
		};
	} else {
		event.locals.user = null;
		event.locals.session = null;
	}

	// NOTE: csrfMiddleware().handle() calls resolve(event) itself and returns that response,
	// so this branch is taken on EVERY request and everything below it is currently
	// unreachable. Headers are therefore applied here — this is the only live exit.
	const csrfResponse = await csrfMiddleware().handle({ event, resolve });
	if (csrfResponse instanceof Response) {
		return finalizeResponse(event, csrfResponse);
	}

	const rateLimitResponse = await applyRateLimiting(event);
	if (rateLimitResponse) {
		return finalizeResponse(event, rateLimitResponse);
	}

	await validateSession(event);
	const startedAt = Date.now();
	const response = await resolve(event);

	// Usage monitor: in-memory only — DB flush is batched inside the
	// monitor itself every few minutes.
	recordRequest(event.url.pathname, Date.now() - startedAt);

	// finalizeResponse runs LAST on purpose: applySecurityHeaders sets an enforcing
	// Content-Security-Policy, and finalizeResponse strips it back to report-only. If the
	// csrf composition above is ever fixed and this path becomes reachable, that ordering
	// is what keeps an untested enforcing CSP from reaching production by surprise.
	return finalizeResponse(event, applySecurityHeaders(event, response));
};

export const handleError = ({ error }: { error: unknown }) => {
	recordServerError(error);
	logger.error({ error }, 'Unhandled server error');
};
