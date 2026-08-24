# Local Dev & Deploy Workflow

## Start the local dev server

```
npm run dev
```

- Open **http://localhost:5173/** (if 5173 is taken, Vite picks 5174 — check the terminal output).
- The server loads `.env` automatically (via `vite.config.ts` dotenv preload) — it connects to the
  **same production Turso database** as Vercel and Netlify, so you are testing real data.

> ⚠️ **Writes go to production.** Creating accounts, watchlist edits, history — all hit the live
> Turso DB. Don't test destructive things with real account names.

## Test → push flow

1. Make your change.
2. `npm run dev` → verify at localhost:5173 (desktop + mobile viewport).
3. `npx svelte-check --threshold error` → must be **0 errors** (42 warnings is the baseline).
4. Commit and push to the **dev** branch (never push to `main` — Vercel auto-deploys `main` to production):

```
git add <files>
git commit -m "feat: ..."
git push fork dev
```

5. Deploys:
   - **Netlify**: build + deploy from the no-space build folder (see below), or connect the repo in
     app.netlify.com for automatic builds.
   - **Vercel**: `npx vercel --prod --yes` — ONLY on explicit human go-ahead. Vercel auto-deploys `main`, so push working code to `dev`, not `main`.

## Netlify deploy command (current manual flow)

Windows can't build this project (SvelteKit Windows ESM bug), so the build runs in WSL:

```
# one-time setup: copy source to a WSL-native folder
wsl -e bash -lc "mkdir -p ~/streamium && cp -r /mnt/c/streamium-nb/src /mnt/c/streamium-nb/static ~/streamium/ && cp /mnt/c/streamium-nb/package.json /mnt/c/streamium-nb/svelte.config.js /mnt/c/streamium-nb/vite.config.ts /mnt/c/streamium-nb/tsconfig.json /mnt/c/streamium-nb/.env.netlify ~/streamium/ && cd ~/streamium && npm install"

# every deploy: sync changed source, build in WSL (Linux), copy output back, deploy
wsl -e bash -lc "cd ~/streamium && cp -r /mnt/c/streamium-nb/src . && cp /mnt/c/streamium-nb/netlify.toml . && set -a && source .env.netlify && set +a && export NETLIFY=true && npm run build"
wsl -e bash -lc "rm -rf /mnt/c/streamium-nb/build /mnt/c/streamium-nb/.netlify/functions-internal /mnt/c/streamium-nb/.netlify/server && cp -r ~/streamium/build /mnt/c/streamium-nb/build && cp -r ~/streamium/.netlify/functions-internal ~/streamium/.netlify/server /mnt/c/streamium-nb/.netlify/"
$env:NETLIFY_AUTH_TOKEN='<token>'
netlify deploy --prod --dir "C:\streamium-nb\build" --site streamium-cosmic
```

(`C:\streamium-nb` is the no-space build folder — SvelteKit cannot build from paths with spaces on
Windows. Its `.netlify` folder is linked to the site.)

## Env notes

- Local `.env` and both hosts use the **same Turso database** — feature flags, announcements and
  content are identical everywhere. `db/client.ts` hard-fails in production if Turso env vars are
  missing (prevents silent data forks).
- `PUBLIC_WATCH_PARTY_URL` — empty = watch party off. When the Cloudflare backend
  (`watch-party-server/`) is deployed, set it on both hosts and flip
  `WATCH_PARTY_ENABLED = true` in `src/lib/config/watchParty.ts`.
- Vercel prod env has a few extra vars (CACHE*TTL*\*, CRON_SECRET, LOG_LEVEL) — mirror them on
  Netlify if behavior ever differs.
