import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

const ALLOWED_EXTENSIONS = /\.(m3u8|mp4|ts|m4s|vtt|srt)(\?|$)/;

export const GET: RequestHandler = async ({ url, fetch }) => {
	const streamUrl = url.searchParams.get('url');
	if (!streamUrl) throw error(400, 'Missing url param');

	if (!ALLOWED_EXTENSIONS.test(streamUrl)) {
		throw error(403, 'Invalid stream URL');
	}

	const res = await fetch(streamUrl, {
		headers: {
			'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
			Origin: 'https://vidlink.pro',
			Referer: 'https://vidlink.pro/',
		}
	});

	if (!res.ok) {
		throw error(502, 'Stream unreachable');
	}

	return new Response(res.body, {
		headers: {
			'Content-Type': res.headers.get('Content-Type') || 'application/vnd.apple.mpegurl',
			'Access-Control-Allow-Origin': '*',
			'Cache-Control': 'public, max-age=60',
		}
	});
};
