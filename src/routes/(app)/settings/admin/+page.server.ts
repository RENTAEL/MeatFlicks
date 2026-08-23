import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

// The admin console lives at /admin now — same shared AdminPanel component.
export const load: PageServerLoad = async () => {
	redirect(301, '/admin');
};
