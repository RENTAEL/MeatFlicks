/**
 * Master switch for the Watch Party feature.
 *
 * Set to false to disable the feature end-to-end: every UI entry point
 * disappears, /watch-party shows a friendly "back soon" message, stale
 * /watch/<code> URLs redirect there, and ALL /api/watch-party/* requests
 * are rejected with 503 before any server work runs (hooks.server.ts).
 *
 * Flip to true to re-enable — nothing else needs to change.
 *
 * Migration note: when the standalone Watch Party backend is live, set
 * PUBLIC_WATCH_PARTY_URL to its origin and flip this back on.
 */
export const WATCH_PARTY_ENABLED = false;

/**
 * Base URL of the standalone Watch Party backend (Cloudflare Worker).
 * Empty string = same-origin (the legacy Vercel API). When the Worker is
 * deployed, set PUBLIC_WATCH_PARTY_URL to its origin (e.g.
 * https://streamium-wp.<account>.workers.dev) and the frontend routes all
 * watch-party calls there instead — no other frontend change needed.
 */
import { env } from '$env/dynamic/public';
export const WATCH_PARTY_URL: string = env.PUBLIC_WATCH_PARTY_URL ?? '';
