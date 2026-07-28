import { json } from '@sveltejs/kit';

export const POST = async ({ request }) => {
	try {
		const body = await request.json();
		const { tmdbId, type, title, poster } = body;

		if (!tmdbId || !type) {
			return json({ error: 'Missing fields' }, { status: 400 });
		}

		return json({ stored: true, timestamp: new Date().toISOString() });
	} catch {
		return json({ error: 'Internal error' }, { status: 500 });
	}
};
