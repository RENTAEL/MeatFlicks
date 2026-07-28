declare namespace App {
	interface Locals {
		user: { id: string; username: string; role: 'ADMIN' | 'USER' } | null;
		session: { id: string; userId: string; expiresAt: Date } | null;
	}
}

declare namespace svelteHTML {
	interface HTMLAttributes<T> {
		webkitallowfullscreen?: boolean | string;
		mozallowfullscreen?: boolean | string;
		'webkit-airplay'?: boolean | string;
		'x-webkit-airplay'?: boolean | string;
		playsinline?: boolean | string;
	}
}
