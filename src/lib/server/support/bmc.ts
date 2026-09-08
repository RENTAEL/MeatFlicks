import crypto from 'node:crypto';

/**
 * Buy Me a Coffee webhook signature helpers.
 * BMC signs the RAW request body with HMAC-SHA256 (hex). Always verify
 * against the raw text — never re-serialize parsed JSON, or the HMAC breaks.
 */
export function computeBmcSignature(rawBody: string, secret: string): string {
	return crypto.createHmac('sha256', secret).update(rawBody, 'utf8').digest('hex');
}

export function verifyBmcSignature(
	rawBody: string,
	signature: string | null | undefined,
	secret: string | undefined
): boolean {
	if (!signature || !secret) return false;
	const expected = computeBmcSignature(rawBody, secret);
	const a = Buffer.from(signature, 'utf8');
	const b = Buffer.from(expected, 'utf8');
	if (a.length !== b.length) return false;
	return crypto.timingSafeEqual(a, b);
}
