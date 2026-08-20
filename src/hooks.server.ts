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

export const handle: Handle = async ({ event, resolve }) => {
	if (!globalThis.__envValidated) {
		try {
			validateApiKeys();
			globalThis.__envValidated = true;
			logger.info('Environment validation completed successfully');
		} catch (error) {
			logger.error({ error }, 'Environment validation failed');
			if (process.env.NODE_ENV === 'production') {
				return new Response('Server configuration error', { status: 500 });
			}
			logger.warn('Running with invalid API keys in development mode');
		}
	}

	const raw = event.cookies.get(createSessionCookieName());
	let sessionData = raw ? decryptSession(raw) : null;
	if (sessionData) {
		try {
			const revoked = await isUserSessionRevoked(
				sessionData.userId,
				sessionData.issuedAt ?? 0
			);
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

	const csrfResponse = await csrfMiddleware().handle({ event, resolve });
	if (csrfResponse instanceof Response) {
		return csrfResponse;
	}

	const rateLimitResponse = await applyRateLimiting(event);
	if (rateLimitResponse) {
		return rateLimitResponse;
	}

	await validateSession(event);
	const response = await resolve(event);

	response.headers.delete('Permissions-Policy');
	response.headers.delete('permissions-policy');
	response.headers.delete('Feature-Policy');
	response.headers.set('Permissions-Policy', 'fullscreen=*');

	return applySecurityHeaders(event, response);
};

export const handleError = ({ error }: { error: unknown }) => {
	recordServerError(error);
	logger.error({ error }, 'Unhandled server error');
};
