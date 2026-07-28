import { fail, redirect } from '@sveltejs/kit';
import { createSessionCookieName, getSessionCookieOptions } from '$lib/server/session-crypto';
import type { Actions } from './$types';

export const actions: Actions = {
	default: async ({ locals, cookies }) => {
		if (!locals.session) {
			return fail(401);
		}
		cookies.delete(createSessionCookieName(), getSessionCookieOptions());
		return redirect(302, '/login');
	}
};
