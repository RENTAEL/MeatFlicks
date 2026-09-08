import { describe, expect, it } from 'vitest';
import { computeBmcSignature, verifyBmcSignature } from './bmc';

const SECRET = 'test-secret-for-unit-tests-only';
const BODY = JSON.stringify({ type: 'donation.created', data: { amount: 5 } });

describe('BMC webhook signature', () => {
	it('accepts a correctly signed body', () => {
		const sig = computeBmcSignature(BODY, SECRET);
		expect(verifyBmcSignature(BODY, sig, SECRET)).toBe(true);
	});

	it('rejects a tampered body', () => {
		const sig = computeBmcSignature(BODY, SECRET);
		expect(verifyBmcSignature(BODY + ' ', sig, SECRET)).toBe(false);
	});

	it('rejects a wrong signature', () => {
		expect(verifyBmcSignature(BODY, '0'.repeat(64), SECRET)).toBe(false);
	});

	it('rejects missing signature or secret', () => {
		expect(verifyBmcSignature(BODY, null, SECRET)).toBe(false);
		expect(verifyBmcSignature(BODY, computeBmcSignature(BODY, SECRET), undefined)).toBe(false);
	});
});
