# E2E regression suite

Playwright checks against the **live production deployment**
(`https://streamium-cosmic.vercel.app`) to guard the Afrikaans-section overhaul.
They are kept out of the normal build path on purpose — they run against whatever
is deployed, so run them after every `vercel --prod` push.

## Prerequisites

- Node 18+ (tested on 24)
- `playwright` installed in the repo (`npm i -D playwright`)

## Running

```sh
npm run test:e2e        # all suites sequentially
node scripts/e2e/main-suite.mjs
node scripts/e2e/afrikaans-rails-sort.mjs
node scripts/e2e/afrikaans-empty-states.mjs
node scripts/e2e/auth-csrf.mjs
```

Each suite prints `PASS/FAIL` lines and exits `0` when green, `1` when anything
fails. Runs take ~1–2 min each; they hit the real TMDB-backed API, so rail/grid
counts can vary slightly day to day but assertions use lower bounds.

## Suites

| File | Coverage |
| --- | --- |
| `main-suite.mjs` | /afrikaans grid renders + Load More appends cards; detail page 200 + player renders; home, movies, tv grids; 375px no horizontal overflow; no page errors. |
| `afrikaans-rails-sort.mjs` | "Nuut: Afrikaans" + "Nuut: Suid-Afrikaans" rails render above the grid with recent cards; sort select has Nuutste/Beoordeling/A–Z; Rating reorders the grid. |
| `afrikaans-empty-states.mjs` | Rails populated (no empty variant shown); gibberish search shows bilingual "Geen resultate / No results" state + Clear button; clicking Clear restores the grid and resets the input. |
| `auth-csrf.mjs` | Page render sets `csrf_token` cookie; a SvelteKit form POST survives CSRF; `/api/*` GETs return 200 and carry **no** `Set-Cookie` (required for Vercel edge caching). |

## Targeting a different deployment

`BASE` is hard-coded at the top of each file. To test the latest `vercel --prod`
without waiting for the alias to propagate, point `BASE` at the deployment URL
Vercel prints (`https://streamium-cosmic-<hash>.vercel.app`) instead.

## Notes

- Afrikaans pages have no `<main>` wrapper, so selectors are global
  (`a[href^="/afrikaans/"]`).
- Grid counts drop to the curated 20-ish list if TMDB discover returns nothing
  for the current date window; assertions are built for that lower bound.
- The search empty-state title interpolates the query — expected to contain the
  gibberish string typed in the test.
- The site shows an intermittent full-screen "uBlock" popup 1.5s after mount on
  Chromium UAs (fresh browser context = never dismissed). It intercepts pointer
  events, so each suite attempts to click its close button (`.popup-close`) after
  loading; if the popup reappears on later navigations inside a suite, dismiss it
  the same way before any click.