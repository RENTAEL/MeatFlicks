import { fail, redirect } from '@sveltejs/kit';
import { generateIdFromEntropySize } from 'lucia';
import { hash } from '@node-rs/argon2';
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
		const email = formData.get('email');
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
		const normalizedEmail =
			typeof email === 'string' && email.trim() !== ''
				? email.trim().toLowerCase()
				: null;
		if (
			normalizedEmail !== null &&
			!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)
		) {
			return fail(400, {
				message: 'Invalid email address'
			});
		}
		if (typeof password !== 'string' || password.length < 6 || password.length > 255) {
			return fail(400, {
				message: 'Invalid password'
			});
		}

		const normalizedUsername = username.toLowerCase();
		const existingUser = await db
			.select()
			.from(users)
			.where(
				or(
					eq(users.username, normalizedUsername),
					normalizedEmail !== null ? eq(users.email, normalizedEmail) : undefined
				)
			)
			.get();
		if (existingUser) {
			return fail(400, {
				message: 'Username or email already taken'
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
				email: normalizedEmail,
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
