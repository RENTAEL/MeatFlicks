import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url, fetch }) => {
	const targetUrl = url.searchParams.get('url');
	if (!targetUrl) throw error(400, 'Missing url param');

	let targetHostname: string;
	try {
		targetHostname = new URL(targetUrl).hostname;
	} catch {
		throw error(400, 'Invalid url param');
	}

	const res = await fetch(targetUrl, {
		headers: {
			'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
			'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
			'Accept-Language': 'en-US,en;q=0.5',
			'Referer': `https://${targetHostname}/`,
		},
		redirect: 'follow',
	});

	const body = await res.arrayBuffer();
	return new Response(body, {
		status: res.status,
		headers: {
			'Content-Type': res.headers.get('content-type') || 'text/html; charset=utf-8',
			'Access-Control-Allow-Origin': '*',
		},
	});
};
