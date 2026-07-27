import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

const ALLOWED_DOMAINS = ['autoembed.co', 'vidlink.pro', 'vidsrc.to', 'player.autoembed.co'];

export const GET: RequestHandler = async ({ url, fetch }) => {
	const targetUrl = url.searchParams.get('url');
	if (!targetUrl) throw error(400, 'Missing url param');

	const hostname = new URL(targetUrl).hostname;
	if (!ALLOWED_DOMAINS.some(d => hostname.includes(d))) {
		throw error(403, 'Domain not allowed');
	}

	const res = await fetch(targetUrl, {
		headers: {
			'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
			'Referer': 'https://autoembed.co/',
		}
	});

	return new Response(res.body, {
		status: res.status,
		headers: {
			'Content-Type': res.headers.get('Content-Type') || 'text/html',
			'Access-Control-Allow-Origin': '*',
		}
	});
};
