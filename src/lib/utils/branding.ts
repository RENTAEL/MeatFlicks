export type BrandingType = 'midnight' | 'sofia' | 'custom' | 'demon_slayer';
export type PreviewBranding = BrandingType | 'streamium';

const BRANDING: Record<string, { type: BrandingType }> = {
	ghostbunny_779: { type: 'midnight' },
	cocolemon: { type: 'sofia' },
	user: { type: 'custom' },
	aftermidnight: { type: 'demon_slayer' }
};

const ADMIN_USERNAME = 'user';

export interface BrandingUser {
	displayName: string | null;
	email: string | null;
}

function normalize(value: string | null | undefined): string | null {
	if (!value) return null;
	const key = value.trim().toLowerCase();
	return key || null;
}

function candidates(user: BrandingUser): (string | null | undefined)[] {
	const emailPrefix = user.email ? user.email.split('@')[0] : null;
	return [user.displayName, emailPrefix, user.email];
}

export function getBranding(user: BrandingUser | null | undefined): BrandingType | null {
	if (!user) return null;
	for (const candidate of candidates(user)) {
		const key = normalize(candidate);
		if (key && BRANDING[key]) return BRANDING[key].type;
	}
	return null;
}

export function isAdminUser(user: BrandingUser | null | undefined): boolean {
	if (!user) return false;
	for (const candidate of candidates(user)) {
		if (normalize(candidate) === ADMIN_USERNAME) return true;
	}
	return false;
}
