# Deploying the Netlify Mirror

Second deployment of Streamium on Netlify, mirroring the Vercel production site.
Both hosts share the **same Turso database** and **same session secret**, so they
serve identical data and accept each other's sessions.

Adapter: `@sveltejs/adapter-auto` (in `svelte.config.js`). It detects the platform
at build time — `NETLIFY` env var → adapter-netlify output, `VERCEL` env var →
adapter-vercel output. One config, both hosts.

---

## 1. Connect the repo to Netlify

### Option A — Dashboard (recommended)

1. Netlify dashboard → **Add new project** → **Import an existing project** → pick the Git provider.
2. Select this repository (push this folder's changes first so `svelte.config.js`, `netlify.toml` land in the repo).
3. Build settings are auto-detected from `netlify.toml`. Verify:
   - Build command: `npm run build`
   - Publish directory: `build`
   - Node version: `20` (from `[build.environment]`)
4. **Add environment variables BEFORE the first deploy** (see checklist below):
   Project configuration → **Environment variables**.
5. Click **Deploy**.

### Option B — CLI

```bash
npm i -g netlify-cli
netlify login
netlify init        # create & link new site, accept defaults from netlify.toml
netlify env:import  # or set vars one-by-one: netlify env:set KEY value
netlify deploy --build --prod
```

Note: Vercel deploys are unaffected — `npx vercel --prod --yes` still builds with
the same config (adapter-auto detects `VERCEL=1` during Vercel remote builds).

---

## 2. Environment variable checklist

Set these in Netlify → Project configuration → Environment variables.
Values must be copied from the same sources Vercel uses (local `.env` / Vercel
dashboard). **Never commit them to git.**

### REQUIRED — build fails without them

| Variable | Notes |
| --- | --- |
| `TMDB_API_KEY` | Hard-required by `src/lib/config/env.ts` + `validate-env.ts`. Same value as Vercel. |
| `TMDB_READ_ACCESS_TOKEN` | Same as above. Same value as Vercel. |

### REQUIRED — shared data + cross-host logins

| Variable | Notes |
| --- | --- |
| `TURSO_DATABASE_URL` | **Must be IDENTICAL to Vercel.** This is what makes both hosts serve the same data. Without it Netlify silently falls back to a local SQLite file (fresh/empty per instance). |
| `TURSO_AUTH_TOKEN` | Must match the URL above (identical to Vercel). |
| `SESSION_SECRET` | Min 32 chars. **Same value on both hosts = session cookie format compatible** (`src/lib/server/session-crypto.ts` derives AES-256-GCM key from it). If unset it falls back to `TMDB_API_KEY`, so identical TMDB keys would also line up — but set `SESSION_SECRET` explicitly on both hosts. |

### REQUIRED for Firebase login on Netlify (public, baked at build time)

Read by `src/lib/firebase/client.ts`. If absent, Firebase auth quietly disables
itself ("auth disabled"). Copy all six values from `.env.example` / Vercel:

- `PUBLIC_FIREBASE_API_KEY`
- `PUBLIC_FIREBASE_AUTH_DOMAIN`
- `PUBLIC_FIREBASE_PROJECT_ID`
- `PUBLIC_FIREBASE_STORAGE_BUCKET`
- `PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
- `PUBLIC_FIREBASE_APP_ID`

### Recommended

| Variable | Notes |
| --- | --- |
| `PUBLIC_BASE_URL` | Set to the Netlify origin (e.g. `https://sitename.netlify.app`) once assigned. Optional in schema; used for canonical URLs. |
| `PUBLIC_TMDB_API_KEY` | Optional; client-side TMDB lookups if any feature uses it. |

### Optional — defaults exist or feature-gated (skip unless used on Vercel)

| Variable | Notes |
| --- | --- |
| `CRON_SECRET` | Only needed if you schedule the cron/API maintenance endpoints against Netlify too. |
| `LOG_LEVEL` | Defaults to `info`. |
| `SQLITE_DB_PATH` | Ignored when Turso vars are set. Leave unset. |
| `CACHE_TTL_SHORT` / `CACHE_TTL_MEDIUM` / `CACHE_TTL_LONG` / `CACHE_MEMORY_MAX_ITEMS` | Numeric defaults exist. |
| `TMDB_IMAGE_BASE_URL` / `TMDB_POSTER_SIZE` / `TMDB_BACKDROP_SIZE` / `TMDB_STILL_SIZE` | TMDB defaults exist. |
| `VIDLINK_API_KEY` / `VIDSRC_API_KEY` | Streaming-provider API keys (optional secrets). |
| `VIDLINK_*` / `VIDSRC_*` / other provider base URLs | All defaulted in `src/lib/config/streaming.ts`; only override if Vercel overrides them. |
| `OMDB_API_KEY` | Ratings feature (`/api/ratings`). |
| `OPENSUBTITLES_API_KEY` | Subtitles feature. Caution: code reads `OPENSUBTITLES_API_KEY` but `.env.example` lists `OPEN_SUBTITLES_API_KEY` — use whichever value Vercel actually has under the code-read name. |
| `TRAKT_CLIENT_ID` | Tracking integration. |
| `CUID_FINGERPRINT` | ID generation fingerprint; has a safe default path. |

---

## 3. Firebase authorized domain (REQUIRED for logins)

The app uses Firebase **client-side auth**. Firebase only accepts redirects from
domains on its allowlist, so logins fail on Netlify until you add the domain:

1. Firebase Console → your project → **Authentication** → **Settings** → **Authorized domains**.
2. **Add domain** → enter the Netlify hostname, e.g. `sitename.netlify.app`.
3. Save. Logins then work on the mirror without any code change.

(Custom domain later? Add that hostname too.)

---

## 4. Watch Party status

Watch Party is disabled by a **code constant**, not env config:
`src/lib/config/watchParty.ts` → `WATCH_PARTY_ENABLED = false`.

It stays disabled identically on BOTH hosts (UI entry points hidden,
`/watch-party` shows "back soon", all `/api/watch-party/*` return 503) until the
standalone Cloudflare backend is live. No Netlify action required — do not flip
the constant for the mirror alone.

---

## 5. Per-host caveats (accepted)

- **In-memory rate limiter**: counters are per server instance. Vercel and
  Netlify (and separate Netlify lambda instances) each count independently, so
  effective limits are roughly additive across hosts. Acceptable.
- **Server error ring buffer**: diagnostics are per instance, not shared.
  Errors seen on Netlify won't show in Vercel's ring and vice versa. Acceptable.
- **Strict TMDB validation asymmetry**: `validateApiKeys()` skips its strictest
  check when `process.env.VERCEL` is set, but runs (non-fatally) on Netlify —
  another reason `TMDB_API_KEY` / `TMDB_READ_ACCESS_TOKEN` must be present there.
- Local `vite build` fails on pre-existing TMDB env validation — that's a local
  machine issue only; CI builds on both hosts are unaffected.

---

## 6. Verify after first deploy

```bash
curl -I https://sitename.netlify.app/
curl    https://sitename.netlify.app/api/health   # or any lightweight endpoint
```

Then spot-check: browse a title page (Turso reads working), log in (Firebase
domain + SESSION_SECRET), confirm Watch Party links are absent (constant still off).
