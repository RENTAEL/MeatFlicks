import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { env } from '$lib/config/env';
import { logger } from '$lib/server/logger';
import { verifyBmcSignature } from '$lib/server/support/bmc';

/**
 * POST /api/bmc-webhook — Buy Me a Coffee webhook receiver.
 * Verifies x-signature-sha256 (HMAC-SHA256 of the RAW body) before doing
 * anything. For now: log the event and 200. Reactions (toast, supporter
 * list, etc.) get wired later.
 */
export const POST: RequestHandler = async ({ request }) => {
	const signature = request.headers.get('x-signature-sha256');
	if (!signature) {
		return json({ error: 'Missing signature' }, { status: 400 });
	}

	const rawBody = await request.text();
	if (!rawBody) {
		return json({ error: 'Empty body' }, { status: 400 });
	}

	if (!env.BUY_ME_A_COFFEE_SIGNING_SECRET) {
		logger.error('BMC webhook received but BUY_ME_A_COFFEE_SIGNING_SECRET is not configured');
		return json({ error: 'Webhook not configured' }, { status: 500 });
	}

	if (!verifyBmcSignature(rawBody, signature, env.BUY_ME_A_COFFEE_SIGNING_SECRET)) {
		return json({ error: 'Invalid signature' }, { status: 401 });
	}

	let event: unknown = null;
	try {
		event = JSON.parse(rawBody);
	} catch {
		return json({ error: 'Invalid JSON' }, { status: 400 });
	}

	logger.info({ event }, 'BMC webhook received');
	return json({ ok: true }, { status: 200 });
};
