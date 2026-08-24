# Streamium — Project Checklist (source of truth)

Last verified against commit **82c3515** (== fork/main). Every item checked against the repo.

---

## 1. Site features

- [x] ✅ Home page: hero, genre rails, trending, continue-watching — `src/routes/(app)/+page.svelte`
- [x] ✅ Newest-releases rails + daily catalog refresh — commit 221d064, `src/lib/server/services/home-library-optimizer.ts`
- [x] ✅ Movie detail pages + player — `src/routes/(app)/movie/[id]`, `src/lib/components/Player.svelte`
- [x] ✅ TV series + episode pages + player — `src/routes/(app)/tv/**`, `TVPlayer.svelte`
- [x] ✅ Hover-to-play card previews + floating popout player — a826746, db6e609, `HoverPreview.svelte`, `PreviewPopout.svelte`
- [x] ✅ Global search overlay + search API — `GlobalSearch.svelte`, `/api/search`
- [x] ✅ Watchlist (folders, tags) + history + playback progress — Turso-backed, cross-device sync
- [x] ✅ Daily Quotes: home chip, lazy modal, /quote page, saved quotes, share banner — 2f9779f, 03a0d04, `DailyQuoteSection.svelte`
- [x] ✅ Quote share banner (Instagram-ready, clean version) — 5bc724b → 39b2d5b
- [x] ✅ Afrikaans section: browse, rails, curated list — `src/routes/(app)/afrikaans/`, `src/lib/server/afrikaans.ts`
- [x] ✅ Afrikaans dedicated player: YouTube-primary chain, 5 embed fallbacks, server-side host probing, per-title `youtubeIds[]` map — `src/lib/components/afrikaans/`, `/afrikaans/watch/[id]` (verified 29/29 titles stable)
- [x] ✅ Adblocker popups (intro + ublock, once-ever) — `AdblockerIntroPopup.svelte`, `UblockPopup.svelte`
- [x] ✅ Mobile browser recommendation popup — `MobileBrowserPopup.svelte` (tracked as of bbf0651)
- [x] ✅ VidLink mobile warning popup (funny, try-other / play-anyway) — a9f74de, `VidLinkMobileWarning.svelte`
- [x] ✅ Profiles, saved quotes, preferences — `src/routes/(app)/profile/**`
- [x] ✅ Content calendar — `ContentCalendar.svelte` (flag-gated, off by default)

## 2. Admin panel

- [x] ✅ Shared AdminPanel component rendered in BOTH /admin console page and Settings — a1c184b
- [x] ✅ Standalone `/admin` page (gated to ADMIN, own header/layout) — `src/routes/(app)/admin/+page.svelte`
- [x] ✅ Live Session Stats panel (section, title, play/pause state, duration; toggleable) — dd2b893, `LiveSessionStats.svelte`
- [x] ✅ Ghost Typing prank (5/8/12s, targeted + global) — dd2b893
- [x] ✅ Pranks: jumpscare (sound + visual), peekaboo, banana cursor, surprise — `CommandPoller.svelte`, `EffectsPanel.svelte`
- [x] ✅ Prank sounds audible for passive viewers (unlocked audio elements) — 611682e
- [x] ✅ Banana cursor Svelte-5 hydration fix — 4ef0fcf
- [x] ✅ Effects target validation (bare ids normalized) — b29feec
- [x] ✅ Guest session monitoring + kick (anonymous visitors visible) — 3e94d7d
- [x] ✅ Targeted broadcasts + persistent dismissal — 3e94d7d, `AnnouncementBanner.svelte`
- [x] ✅ Admin impersonation (real-time user list, banner, data isolation) — 19c6aa2, a1dede8
- [x] ✅ Watch-party admin: active sessions panel, end-all, clear-orphans — `ActiveSessionsPanel.svelte`
- [x] ✅ Catalog refresh, feature flags, stats, error ring — `AdminPanel.svelte`, `/api/admin/*`
- [x] ✅ site_commands table self-heal — 99bed61
- [x] ✅ Admin console nav entry (desktop + mobile menu) — a1c184b

## 3. Mobile fixes

- [x] ✅ Global header clearance (no page starts under fixed nav) — e8475d8
- [x] ✅ Sheet Play dismisses + navigates (ordering fix) — 17b448f
- [x] ✅ No mid-play provider churn; reconnect affordance — eebf37c
- [x] ✅ 10s freeze fix (iframe errors verified against embed silence; src guard) — c4bf2f0
- [x] ✅ Tap targets ≥44px, tap delay removed, accent tap highlight — b0780ab
- [x] ✅ Ambient particles reduced on mobile + frozen during playback — b0780ab, eebf37c
- [x] ✅ Player stall hint ("Taking a while? Use the server list") — b0780ab
- [x] ✅ Mobile profile nav + surprise-movies-only — e05f5d3
- [x] ✅ Mobile sign-in / scroll / popup fixes (earlier session batch)

## 4. Deployment

- [x] ✅ Vercel: git-connected to RENTAEL/MeatFlicks — AUTO-DEPLOYS prod on push to `main`. Push to `dev` instead; `main` is production-locked. CLI deploy `npx vercel --prod --yes` only on explicit go-ahead.
- [x] ✅ Netlify mirror: `netlify.toml`, adapter-auto (dual-host), site **streamium-cosmic.netlify.app** LIVE
- [x] ✅ Netlify fixes: devalue + @sveltejs/kit as prod deps, shamefully-hoist (.npmrc), Node 20, adapter-netlify 6.0.4 — 83af4cb
- [x] ✅ Netlify env vars imported from Vercel parity set (Turso, TMDB, cache, PUBLIC_BASE_URL)
- [x] ✅ Turso production guard: hard-fail if TURSO_DATABASE_URL missing in prod (no data forks) — 0c96e8e
- [x] ✅ Cache headers: immutable for /_app/immutable, /sounds/*, favicons — netlify.toml
- [x] ⚠️ **Vercel auto-deploys prod on push to `main`** — confirmed live (pushes to `main` shipped unprompted). Switched default push target to `dev` so GitHub pushes no longer ship to production. Deploy only via `npx vercel --prod --yes` (or merge `dev`→`main`) on explicit human go-ahead.
- [x] ⚠️ **Netlify deploys currently return Forbidden** (started after ~8 rapid deploys; likely temporary abuse throttle). Last GOOD deploy live = "turso cache tier + dq chip fix". The sized-gate fix (82c3515) is pushed but NOT deployed yet.
- [x] ✅ Deploy runbook — `LOCAL-DEV.md` + `DEPLOY-NETLIFY.md`

## 5. Database (Turso)

- [x] ✅ Single source of truth: users, watchlist, history, progress, quotes, flags, announcements, sessions-revocations, presence — all Turso (audited)
- [x] ✅ Production hard-fail prevents file-DB data forks — `db/client.ts`
- [x] ✅ Sessions: stateless AES-GCM cookie + Turso revocation checks — cross-host portable with same SESSION_SECRET derivation
- [x] ✅ Turso-backed cache tier (cold starts warm; sized-gated ≥5KB payloads) — 9f63725 + 82c3515
- [x] ℹ️ Per-instance-only (acceptable): rate limiter, error ring, LRU warmth, WP event pub-sub

## 6. Watch Party

- [x] ✅ Feature built: rooms, join/leave, chat, queue, kick, sounds, sync (host-mirror architecture) — intact, disabled
- [x] ✅ Join feedback overlay + sync reliability fixes — c32dc5d
- [x] ✅ **KILL SWITCH ACTIVE**: `WATCH_PARTY_ENABLED = false` in `src/lib/config/watchParty.ts`
  - hooks 503s all `/api/watch-party/*` before any work
  - /watch-party shows "snack break" page; /watch/<code> redirects there
  - all UI entry points hidden (home strip, nav, detail buttons, admin section)
- [x] ✅ Server-side intervals throttled (tick 5s, admin streams 15-30s, presence poll 10s, prune interval removed)
- [x] ✅ Client SSE paused when tab hidden (guest, user, room, admin streams) — eebf37c-era + CPU work
- [x] ⚠️ **Cloudflare Worker backend built but NOT deployed** — `watch-party-server/` (DO per room, SSE contract mirror, TTL alarm). Needs: `wrangler login && wrangler deploy`, then set `PUBLIC_WATCH_PARTY_URL` + flip the flag.

## 7. Performance

- [x] ✅ Turso-backed cache tier for TMDB/catalog responses — cold starts warm
- [x] ✅ Preconnect/dns-prefetch: image.tmdb.org + api.themoviedb.org — app.html
- [x] ✅ Static asset cache headers — netlify.toml
- [x] ✅ Ambient animation budget (8 particles mobile, frozen during playback)
- [x] ✅ Firebase fully dynamic-imported (verified — not in eager bundle)
- [x] ✅ Dev dotenv preload in vite.config.ts (fixes dev + local build env validation)
- [x] ℹ️ Eager JS payload measured small (entry + app + route nodes); 548KB firebase chunk is lazy (auth-only)

## 8. Theming / personalization

- [x] ✅ Per-user themes + branding (aftermidnight = Demon Slayer: palette, 3D eye, custom background, flame accents) — c318a9b → 9bd79df
- [x] ✅ user2 playground: 10 experiments, 7 rolled out site-wide (Surprise, streak, tagline, mood, progress bar, time-joined) — d57274b
- [x] ✅ Cursor trail removed (intentional) — 0f90a9b

---

## Pending / needs attention

1. **Vercel fair-use block** — site paused (402). Resolve in Vercel dashboard → then `npx vercel --prod --yes`.
2. **Netlify deploy Forbidden** — temporary throttle suspected. Retry `netlify deploy` from WSL (see LOCAL-DEV.md) on the 1st; the sized-gate commit 82c3515 ships then.
3. **Cloudflare Worker deploy** — `watch-party-server/` ready; `npx wrangler login && npx wrangler deploy`, set `PUBLIC_WATCH_PARTY_URL`, flip `WATCH_PARTY_ENABLED = true`.
4. **Firebase authorized domains** — add the Netlify domain in Firebase console or logins fail there.
5. **Watch Party re-enable checklist** — flip flag → verify both hosts → confirm Vercel CPU stays under limit.
6. **Netlify Git connection (optional)** — linking the repo would give push-to-deploy; currently deploys are manual CLI from WSL.
