import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	// Layout already gates to ADMIN — this only feeds the header.
	return {
		username: locals.user?.username ?? 'admin'
	};
};
