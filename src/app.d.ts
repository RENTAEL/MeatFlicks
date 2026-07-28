declare namespace App {
	interface Locals {
		user: import('lucia').User | null;
		session: import('lucia').Session | null;
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
