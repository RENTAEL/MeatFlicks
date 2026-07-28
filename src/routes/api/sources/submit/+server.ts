import { json } from '@sveltejs/kit';

export const POST = async ({ request }) => {
	try {
		const body = await request.json();
		const { tmdbId, type, url, label } = body;

		if (!tmdbId || !url) {
			return json({ error: 'Missing tmdbId or url' }, { status: 400 });
		}

		try {
			new URL(url);
		} catch {
			return json({ error: 'Invalid URL' }, { status: 400 });
		}

		console.log('[Source Submit]', { tmdbId, type, url, label });

		return json({ success: true });
	} catch {
		return json({ error: 'Internal error' }, { status: 500 });
	}
};
