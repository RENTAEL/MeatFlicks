import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getCsrfToken, generateSecureCsrfToken, createSecureCsrfCookie } from '$lib/server/csrf';

export const GET: RequestHandler = async ({ cookies }) => {
	let token = getCsrfToken({ cookies });
	if (!token) {
		const fresh = generateSecureCsrfToken();
		const cookie = createSecureCsrfCookie(fresh);
		cookies.set(cookie.name, cookie.value, cookie.attributes);
		token = fresh.token;
	}
	return json({ token }, { headers: { 'Cache-Control': 'private, no-store' } });
};