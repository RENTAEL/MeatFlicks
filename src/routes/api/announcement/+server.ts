import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getAnnouncement } from '$lib/server/admin/service';
import { errorHandler } from '$lib/server';

export const GET: RequestHandler = async () => {
	try {
		return json({ announcement: await getAnnouncement() });
	} catch (error) {
		const { status, body } = errorHandler.handleError(error);
		return json(body, { status });
	}
};
