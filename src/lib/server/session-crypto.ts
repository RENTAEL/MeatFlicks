import { randomBytes, createCipheriv, createDecipheriv, createHash } from 'node:crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const TAG_LENGTH = 16;
const COOKIE_NAME = 'session';

function deriveKey(): Buffer {
	const seed = process.env.SESSION_SECRET || process.env.TMDB_API_KEY || 'streamium-dev-secret';
	return createHash('sha256').update(seed).digest();
}

export interface SessionData {
	userId: string;
	username: string;
	role: 'ADMIN' | 'USER';
	expiresAt: number;
	/** When this session was issued — sessions issued before a revocation are invalid. */
	issuedAt?: number;
}

export function createSessionCookieName(): string {
	return COOKIE_NAME;
}

export function encryptSession(data: SessionData): string {
	const iv = randomBytes(IV_LENGTH);
	const cipher = createCipheriv(ALGORITHM, deriveKey(), iv);
	const plain = JSON.stringify(data);
	const encrypted = Buffer.concat([cipher.update(plain, 'utf-8'), cipher.final()]);
	const tag = cipher.getAuthTag();
	return Buffer.concat([iv, tag, encrypted]).toString('base64url');
}

export function decryptSession(encoded: string): SessionData | null {
	try {
		const buf = Buffer.from(encoded, 'base64url');
		const iv = buf.subarray(0, IV_LENGTH);
		const tag = buf.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH);
		const encrypted = buf.subarray(IV_LENGTH + TAG_LENGTH);
		const decipher = createDecipheriv(ALGORITHM, deriveKey(), iv);
		decipher.setAuthTag(tag);
		const plain = decipher.update(encrypted) + decipher.final('utf-8');
		const data = JSON.parse(plain) as SessionData;
		if (data.expiresAt && Date.now() < data.expiresAt) return data;
		return null;
	} catch {
		return null;
	}
}

export function getSessionCookieOptions() {
	const isDev = process.env.NODE_ENV === 'development';
	return {
		path: '/',
		httpOnly: true,
		secure: !isDev,
		sameSite: 'lax' as const,
		maxAge: 60 * 60 * 24 * 30
	};
}
