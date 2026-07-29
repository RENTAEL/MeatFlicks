import { fail, redirect } from '@sveltejs/kit';
import { hash, verify } from '@node-rs/argon2';
import { db } from '$lib/server/db';
import { users } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import type { PageServerLoad, Actions } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user) throw redirect(302, '/login');

	const user = await db.select({
		id: users.id,
		username: users.username,
		email: users.email
	}).from(users).where(eq(users.id, locals.user.id)).get();

	return { user: user ?? { id: locals.user.id, username: locals.user.username, email: null } };
};

export const actions: Actions = {
	default: async ({ request, locals }) => {
		if (!locals.user) throw redirect(302, '/login');

		const data = await request.formData();
		const username = data.get('username')?.toString().trim();
		const email = data.get('email')?.toString().trim();
		const currentPassword = data.get('currentPassword')?.toString();
		const newPassword = data.get('newPassword')?.toString();

		const errors: Record<string, string> = {};

		if (username && username !== locals.user.username) {
			const existing = await db.select({ id: users.id })
				.from(users)
				.where(eq(users.username, username.toLowerCase()))
				.get();

			if (existing && existing.id !== locals.user.id) {
				errors.username = 'Username already taken';
			} else if (username.length < 2) {
				errors.username = 'Username must be at least 2 characters';
			} else if (!/^[a-zA-Z0-9_-]+$/.test(username)) {
				errors.username = 'Only letters, numbers, hyphens, and underscores';
			}
		}

		if (email) {
			const existing = await db.select({ id: users.id })
				.from(users)
				.where(eq(users.email, email))
				.get();
			if (existing && existing.id !== locals.user.id) {
				errors.email = 'Email already in use';
			} else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
				errors.email = 'Invalid email format';
			}
		}

		if (newPassword || currentPassword) {
			if (!currentPassword) {
				errors.currentPassword = 'Current password is required to change password';
			} else if (!newPassword) {
				errors.newPassword = 'New password is required';
			} else {
				const user = await db.select({ passwordHash: users.passwordHash })
					.from(users)
					.where(eq(users.id, locals.user.id))
					.get();

				if (!user) {
					errors.currentPassword = 'User not found';
				} else {
					const valid = await verify(user.passwordHash, currentPassword, {
						memoryCost: 19456,
						timeCost: 2,
						outputLen: 32,
						parallelism: 1
					});
					if (!valid) {
						errors.currentPassword = 'Current password is incorrect';
					} else if (newPassword.length < 8) {
						errors.newPassword = 'Password must be at least 8 characters';
					}
				}
			}
		}

		if (Object.keys(errors).length > 0) {
			return fail(400, { errors, values: { username, email } });
		}

		const setValues: Record<string, string> = {};

		if (username && username !== locals.user.username) {
			setValues.username = username.toLowerCase();
		}

		if (email) {
			setValues.email = email;
		}

		if (newPassword) {
			setValues.passwordHash = await hash(newPassword, {
				memoryCost: 19456,
				timeCost: 2,
				outputLen: 32,
				parallelism: 1
			});
		}

		const keys = Object.keys(setValues);
		if (keys.length > 0) {
			await db.update(users)
				.set(setValues)
				.where(eq(users.id, locals.user.id));
		}

		return { success: true };
	}
};
