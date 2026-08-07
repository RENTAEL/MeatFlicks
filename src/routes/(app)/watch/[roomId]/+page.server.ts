import { error, redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { getRoomState } from '$lib/server/watch-party/service';
import { roomIdSchema } from '$lib/server/watch-party/handlers';

export const load: PageServerLoad = async ({ params, locals }) => {
	const parsed = roomIdSchema.safeParse(params.roomId);
	if (!parsed.success) throw error(404, 'Room not found');

	if (!locals.user) {
		throw redirect(307, `/login?next=/watch/${encodeURIComponent(parsed.data)}`);
	}

	const viewer = { id: locals.user.id, username: locals.user.username };
	const state = await getRoomState(parsed.data, viewer);

	if (state.closed) throw error(410, 'This watch party has ended');

	return {
		roomId: parsed.data,
		user: { id: locals.user.id, username: locals.user.username },
		initialState: state
	};
};