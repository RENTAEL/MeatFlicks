export interface ImpersonatedUser {
	id: string;
	username: string;
	email: string | null;
}

let impersonated = $state<ImpersonatedUser | null>(null);

export const impersonationStore = {
	get current() {
		return impersonated;
	},
	get isImpersonating() {
		return impersonated !== null;
	},
	impersonate(user: ImpersonatedUser) {
		impersonated = user;
		// Also set preview to custom so branding reflects impersonated user
		try {
			localStorage.setItem('impersonated_user', JSON.stringify(user));
		} catch {}
	},
	clear() {
		impersonated = null;
		try {
			localStorage.removeItem('impersonated_user');
		} catch {}
	},
	init() {
		try {
			const raw = localStorage.getItem('impersonated_user');
			if (raw) {
				impersonated = JSON.parse(raw) as ImpersonatedUser;
			}
		} catch {}
	}
};

// Auto-init on client
if (typeof window !== 'undefined') {
	impersonationStore.init();
}
