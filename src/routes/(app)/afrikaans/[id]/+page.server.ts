import { redirect } from '@sveltejs/kit';

/**
 * Direct /afrikaans/<id> links land in the dedicated Afrikaans player —
 * the main /movie and /tv playback paths are never touched.
 */
export async function load({ params }) {
	const { id } = params;
	if (!/^\d+$/.test(id)) throw redirect(301, '/afrikaans');
	throw redirect(301, `/afrikaans/watch/${id}`);
}
