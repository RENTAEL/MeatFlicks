import { fail, redirect } from '@sveltejs/kit';
import { verify } from '@node-rs/argon2';
import { db } from '$lib/server/db';
import { users } from '$lib/server/db/schema';
import { getCsrfToken } from '$lib/server/csrf';
import { encryptSession, createSessionCookieName, getSessionCookieOptions } from '$lib/server/session-crypto';
import type { Actions, PageServerLoad } from './$types';
import { eq, or } from 'drizzle-orm';

export const load: PageServerLoad = async ({ locals, cookies }) => {
	if (locals.user) {
		throw redirect(302, '/');
	}
	return {
		csrfToken: getCsrfToken({ cookies })
	};
};

export const actions: Actions = {
	default: async ({ request, cookies }) => {
		const formData = await request.formData();
		const username = formData.get('username');
		const password = formData.get('password');

		if (typeof username !== 'string' || typeof password !== 'string') {
			return fail(400, {
				message: 'Invalid username or password'
			});
		}

		const normalizedUsername = username.toLowerCase();
		const existingUser = await db
			.select()
			.from(users)
			.where(or(eq(users.username, normalizedUsername), eq(users.email, normalizedUsername)))
			.get();
		if (!existingUser) {
			return fail(400, {
				message: 'Incorrect username or password'
			});
		}

		const validPassword = await verify(existingUser.passwordHash, password, {
			memoryCost: 19456,
			timeCost: 2,
			outputLen: 32,
			parallelism: 1
		});

		if (!validPassword) {
			return fail(400, {
				message: 'Incorrect username or password'
			});
		}

		const cookie = encryptSession({
			userId: existingUser.id,
			username: existingUser.username,
			role: existingUser.role,
			expiresAt: Date.now() + 86400 * 1000 * 30,
		});
		cookies.set(createSessionCookieName(), cookie, getSessionCookieOptions());

		return redirect(302, '/');
	}
};
