import { fail, redirect } from '@sveltejs/kit';
import { generateIdFromEntropySize } from 'lucia';
import { hash } from '@node-rs/argon2';
import { db } from '$lib/server/db';
import { users } from '$lib/server/db/schema';
import { getCsrfToken } from '$lib/server/csrf';
import { encryptSession, createSessionCookieName, getSessionCookieOptions } from '$lib/server/session-crypto';
import type { Actions, PageServerLoad } from './$types';
import { eq } from 'drizzle-orm';

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

		if (
			typeof username !== 'string' ||
			username.length < 3 ||
			username.length > 31 ||
			!/^[a-zA-Z0-9_-]+$/.test(username)
		) {
			return fail(400, {
				message: 'Invalid username'
			});
		}
		if (typeof password !== 'string' || password.length < 6 || password.length > 255) {
			return fail(400, {
				message: 'Invalid password'
			});
		}

		const normalizedUsername = username.toLowerCase();
		const existingUser = await db.select().from(users).where(eq(users.username, normalizedUsername)).get();
		if (existingUser) {
			return fail(400, {
				message: 'Username already taken'
			});
		}

		const passwordHash = await hash(password, {
			memoryCost: 19456,
			timeCost: 2,
			outputLen: 32,
			parallelism: 1
		});
		const userId = generateIdFromEntropySize(10);

		try {
			await db.insert(users).values({
				id: userId,
				username: normalizedUsername,
				passwordHash,
				role: 'USER'
			});

			const cookie = encryptSession({
				userId,
				username: normalizedUsername,
				role: 'USER',
				expiresAt: Date.now() + 86400 * 1000 * 30,
			});
			cookies.set(createSessionCookieName(), cookie, getSessionCookieOptions());
		} catch (e) {
			console.error(e);
			return fail(500, {
				message: 'An unknown error occurred'
			});
		}
		return redirect(302, '/');
	}
};
