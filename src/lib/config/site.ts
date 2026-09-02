/**
 * The public origin this deployment is served from.
 *
 * Everything crawlers and social platforms read — canonical URLs, og:url,
 * JSON-LD ids and the sitemap — must agree on one origin. Keep this the single
 * source of truth; a mismatch tells search engines to credit another site.
 *
 * This is a plain constant on purpose. It is read by components that render on
 * both the server and the client, so reading it from `process.env` would resolve
 * on the server and fall back in the browser, producing a hydration mismatch in
 * the <head>. Change it here when the production domain changes.
 */
export const SITE_URL = 'https://streamium-cosmic.vercel.app';
