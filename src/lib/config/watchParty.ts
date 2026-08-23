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
