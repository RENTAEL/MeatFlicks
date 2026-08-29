import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requireAdmin } from '$lib/server/watch-party/handlers';
import { db } from '$lib/server/db';
import { users } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import { errorHandler } from '$lib/server';

// Admin-only lookup of a single user by username. Used by the "View as Sune" eye
// to resolve Sune's record for impersonation. Mirrors the guard used by the
// /api/admin/users/stream endpoint.
export const GET: RequestHandler = async ({ locals, params }) => {
	try {
		requireAdmin(locals);

		const username = (params.username || '').toLowerCase();
		if (!username) {
			return json({ error: 'Missing username' }, { status: 400 });
		}

		const user = await db
			.select({ id: users.id, username: users.username, email: users.email })
			.from(users)
			.where(eq(users.username, username))
			.get();

		if (!user) {
			return json({ error: 'User not found' }, { status: 404 });
		}

		return json({ user });
	} catch (error) {
		const { status, body } = errorHandler.handleError(error);
		return json(body, { status });
	}
};
