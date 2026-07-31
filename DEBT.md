# Debt List

Tracked technical debt and follow-ups. Entries are removed once resolved.

- [ ] **TMDB API key exposure** — `PUBLIC_TMDB_API_KEY` is used client-side in `src/routes/(app)/tv/[id]/+page.ts` (TMDB calls made from the browser; key visible in the shipped JS/SSR payload). Server-side routes already use `env.TMDB_API_KEY` via `tmdb.service.ts`. Follow-up: move the `+page.ts` TMDB fetches server-side (or through `/api/tmdb/...` routes) so no key is exposed client-side. Flagged by user, Jul 2026.
