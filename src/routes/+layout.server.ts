import type { LayoutServerLoad } from './$types';
import { db } from '$lib/server/db';
import { users } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';

export const load: LayoutServerLoad = async ({ locals }) => {
	if (!locals.user) {
		return { user: null };
	}
	const row = await db
		.select({ email: users.email })
		.from(users)
		.where(eq(users.id, locals.user.id))
		.get();
	return {
		user: {
			id: locals.user.id,
			username: locals.user.username,
			role: locals.user.role,
			email: row?.email ?? null
		}
	};
};
