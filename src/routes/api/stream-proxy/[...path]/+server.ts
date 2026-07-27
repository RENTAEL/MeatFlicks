import type { RequestHandler } from './$types';

const ROUTES: Record<string, string> = {
	'autoembed.co': 'https://player.autoembed.co',
	vidlink: 'https://vidlink.pro',
	vidsrc: 'https://vidsrc.to',
};

export const GET: RequestHandler = async ({ params, url, fetch }) => {
	const pathStr = params.path ?? '';
	if (!pathStr) {
		return new Response(JSON.stringify({ error: 'Missing path' }), {
			status: 400,
			headers: { 'Content-Type': 'application/json' },
		});
	}

	const segments = pathStr.split('/').filter(Boolean);
	const provider = segments[0]?.toLowerCase() ?? '';
	const rest = segments.slice(1).join('/');

	const baseUrl = ROUTES[provider];
	if (!baseUrl) {
		return new Response(JSON.stringify({ error: `Unknown provider: ${provider}` }), {
			status: 400,
			headers: { 'Content-Type': 'application/json' },
		});
	}

	const targetUrl = `${baseUrl}/${rest}${url.search}`;

	try {
		const res = await fetch(targetUrl, {
			headers: {
				'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
				'Referer': `${baseUrl}/`,
				'Origin': baseUrl,
				'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
				'Accept-Language': 'en-US,en;q=0.5',
			},
		});

		if (!res.ok) {
			return new Response(JSON.stringify({
				error: `Provider returned ${res.status}`,
				provider
			}), {
				status: 502,
				headers: { 'Content-Type': 'application/json' },
			});
		}

		const contentType = res.headers.get('Content-Type') || 'text/html';

		if (contentType.includes('text/html')) {
			let body = await res.text();
			const pattern = baseUrl.replace(/\./g, '\\.');
			body = body.replace(new RegExp(`${pattern}/`, 'g'), `/api/stream-proxy/${provider}/`);

			return new Response(body, {
				status: 200,
				headers: {
					'Content-Type': contentType,
					'Cache-Control': 'public, max-age=300',
				},
			});
		}

		const buffer = await res.arrayBuffer();
		return new Response(buffer, {
			status: 200,
			headers: {
				'Content-Type': contentType,
				'Cache-Control': 'public, max-age=3600',
			},
		});
	} catch (err) {
		console.error(`Proxy error for ${provider}/${rest}:`, (err as Error).message);
		return new Response(JSON.stringify({
			error: 'Provider unreachable',
			detail: (err as Error).message,
			provider
		}), {
			status: 502,
			headers: { 'Content-Type': 'application/json' },
		});
	}
};
