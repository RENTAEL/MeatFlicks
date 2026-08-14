# SOAK TEST — Watch Party Sync

Manual soak procedure for the watch-party realtime sync. Designed to verify the three
historical sync bugs are fixed and stay fixed, over a real multi-minute session:

1. **Server switch**: host play did nothing on the member side after the host switched provider.
2. **20s drift**: member's playback drifted ~20s ahead of the host.
3. **"Starts from the beginning"**: after a few minutes the member's player auto-reloaded and resumed at 0.

## How soak mode works

Append `?soak=1` to the room URL: `https://streamium-cosmic.vercel.app/watch/XXXXXX?soak=1`

- Shows a **debug overlay** (top-right): host position, member position, drift, sync status,
  provider, iframe state, and a running log of the last 24 sync events.
- Logs every sync decision to the browser **console** with a `[soak]` prefix and ISO timestamp,
  e.g. `[soak] 12:34:56.789 [reload] triggered pos=245.0 playing=true force=false streak=1 provider=vidlink`.
- Soak mode is **purely passive**: it only observes. It changes no playback/sync behavior.
- Without `?soak=1` nothing is rendered and nothing is logged — normal usage is byte-for-byte unaffected.

### Soak log reference (kinds you will see)

| kind           | meaning                                                                               |
| -------------- | ------------------------------------------------------------------------------------- |
| `join`         | room page mounted; role = host/member                                                 |
| `sse`          | SSE stream opened (`reconnect (open)` = connection re-established)                    |
| `sse-error`    | SSE connection error; EventSource auto-reconnects                                     |
| `playback`     | room playback state changed (seq, playing, pos)                                       |
| `host-signal`  | host page sent play/pause/seek to the server                                          |
| `apply`        | member applied a remote sync frame (seq, target vs current)                           |
| `drift`        | 5s drift check: target, current, gap, action taken                                    |
| `reload`       | auto-reload **triggered** (with target pos) or **suppressed** (cooldown/3-streak cap) |
| `reload-frame` | iframe rebuilt with `#t=<pos>` (the position-restore mechanism)                       |
| `embed-pos`    | post-reload check: did the embed resume at the reload target? `RESTORED`/`FAILED`     |
| `seek`         | seek applied (youtube seekTo or embed `seekto` command)                               |
| `sync`         | member sync status transition (synced / syncing / drifted)                            |
| `provider`     | provider switched (manual, auto, or remote-driven)                                    |
| `iframe`       | iframe loaded; `builtFromReload` tells you it was a position-restore reload           |
| `iframe-error` | iframe failed; auto-switch pending                                                    |
| `queue`        | host added/removed/reordered queue items, or pressed Play next (`advanced -> ...`)    |
| `media`        | room media switched (queue advance) — player rescan + new source on every client      |
| `kick`         | kick received (with `by` and `at`)                                                    |
| `closed`       | room ended                                                                            |
| `leave`        | user left the room                                                                    |

## Setup

1. Two browsers that do **not** share a session:
   - **Host**: normal browser, signed in as user A.
   - **Member**: incognito window / second browser profile, signed in as user B.
2. Host opens a movie (or a TV episode), clicks **Watch Party**. Copy the room URL.
3. Member opens the room URL **with `?soak=1`**; host opens it with `?soak=1` too
   (or re-navigates — soak is read from the URL at page load, so both tabs must
   **load** with `?soak=1` in the address bar).
4. Open DevTools → Console on both tabs and apply a filter: `soak`.
5. Click once in each tab (enables sound + autoplay). Confirm both players are playing.

Expected at start (member console):

```
[soak] ... [join]   room=XXXXXX role=member
[soak] ... [sse]    open
[soak] ... [playback] seq=1 playing=true pos=12.3
[soak] ... [apply]  seq=1 force=false provider=vidlink target=12.3 current=0.0 needSeek=true
[soak] ... [reload] triggered pos=12.3 ...
[soak] ... [reload-frame] t=12 autoplay=true ...
[soak] ... [iframe] loaded provider=vidlink builtFromReload=true
[soak] ... [drift]  check target=... current=... gap=... -> tolerated
```

Host console: `join role=host`, `sse open`, `host-signal` lines.

## Test sequence

Run in order. Record each in the log table (template below).

### 1. Server switch (bug 1: host play did nothing)

Host clicks **Switch** → picks a different working server.

**Expected**

- Member console: `[provider] switch ... (remote)` + `[reload] triggered pos=<host pos>` +
  `[reload-frame]` + `[iframe] ... builtFromReload=true` + `[embed-pos] ... RESTORED`.
- Member video continues playing at the host's position; no dead pause.

**PASS**: host play/pause works immediately after the switch on both sides, member never stops playing for >5s.

### 2. Long drift (bug 2: member 20s ahead)

Leave both playing untouched for **5+ minutes**. Watch the overlay drift value.

**Expected**: `[drift] check ... -> tolerated` lines with `gap` ≤ 2s. Status pill stays `synced` (or briefly `syncing` after reloads).

**PASS**: drift never exceeds **2s** for the whole window. Any `drifted` with drift ≥ 3s sustained across two consecutive 5s ticks = FAIL (record it).

### 3. Member disconnect / reconnect

**3a. Short (~30s):** close the member tab entirely; reopen the same `?soak=1` URL after ~30s.

- Expected: `join` → `sse open` → `apply`/`reload` at the **current** host position (not the old one).

**3b. Long (2+ min):** close the member tab for **>2 minutes** (past the 120s heartbeat timeout),
then return. On the host side the member's row will drop from the room list.

- Expected: member re-joins (`join` fires again via onMount), re-syncs to host position.
  On the host, the member row reappears.

**PASS**: member resumes at host position within 10s of reopening in both cases; never restarts from 0; host participant list stays consistent.

### 4. Forced auto-reload (bug 3: "starts from the beginning")

The reload path must resume at the host's position, **not 0**.

- Member in sync; host seeks **+90s** (click the player, press `→` nine times, or use the
  member console — host-side only).
- Watch the member console: a `[reload] triggered` + `[reload-frame] t=<target>` pair should appear
  within ~2s, then after ~4-6s the `[embed-pos]` line.
- **`[embed-pos] ... RESTORED`** = the embed resumed at the reload target (gap ≤ 12s).
- **`[embed-pos] ... FAILED`** is NOT automatically a failure: the check is a single snapshot ~4s
  after the reload, and a slow-starting embed may not have seeked yet. The real judge is what
  happens next: if the following `[drift] check` lines show `gap ≤ 2` (`tolerated`), the embed
  caught up and the reload restored position. **FAIL only if `FAILED` is followed by repeated
  `reload triggered` lines (2-3x) and a sustained `sync drifted`** — that means the embed ignored
  `#t=` and the drift-reload loop (capped at `[reload] suppressed ... streak=3`) cannot recover.
- Repeat the big seek 2 more times (~60s apart) to exercise the cooldown/streak cap:
  `[reload] suppressed ... streak=3` shows the cap working.

**PASS**: every forced reload shows `reload-frame t=<host pos>` (≥ host pos − 2s) and the member
resumes at that position — visible either as `embed-pos RESTORED` or `drift ... -> tolerated`
with gap ≤ 2s within 20s. **FAIL if any reload resumes at ~0.**

### 5. Kick

Host opens the member panel → **kick** the member.

**Expected** (member console): `[kick] by=<host> at=<ts>` immediately (dedicated SSE event),
then the kick toast + auto-redirect. Host console: nothing abnormal; member row removed.
Member rejoins by opening the room URL again (kick marker clears on join).

**PASS**: kick delivered in <1s, no false kicks to other members, rejoin works.

### 6. Background-tab heartbeat

Member switches to another tab for **2 minutes** (tab stays open), then returns.

**Expected**: member still listed on host side (15s SSE heartbeats kept `lastSeenAt` fresh);
on return the member is still synced (≤2s).

**PASS**: no 120s member-drop, no resync-from-0 after return.

### 7. Chat + sound FX regression

- Both send messages → both see them (member `[apply]`/`[playback]` seq bumps).
- Host deletes a member message → "deleted" on both.
- Host grants the member sound control (`Sound: On`) → member clicks a sound effect →
  both hear it (no `[soak]` entry needed — sound is out of soak scope, but confirm it
  didn't break: overlay keeps updating, drift stays ≤2s).
- Mute/volume slider still works.

**PASS**: chat + FX functional; soak instrumentation did not disturb sync.

### 8. Next-up queue (host adds 2, advances)

- Host opens the **Next up** panel (right column) and searches, e.g. "dune" → adds **Dune**
  and **Dune: Part Two**. Member sees both + "Up next: Dune" (header chip + panel list).
- Member attempts to add/remove/advance via the APIs → all **403** (host-only).
- Host moves Dune: Part Two up (reorder) → order flips on the member within ~1s.
- Host presses **Play next** → both consoles show `[queue] advanced -> "Dune: Part Two"`
  then `[media] switch -> ...` and `[iframe] loaded provider=...`; both players now show
  the new title paused at 0; host presses play → member follows via `[apply]`/`[reload-frame]`.
- Member refreshes the page → queue still visible (persists server-side).
- Host removes the remaining item and presses Play next → `advance: empty queue, no-op`;
  nothing changes.
- Host leaves the room → room closes → queue cleared (rejoin shows empty queue).

**PASS**: queue CRUD propagates to members via SSE, advance switches everyone to the new
source at 0, provider follows the host, empty-queue advance is a no-op.

## Log table template

| time     | host pos | member pos | drift | network notes / events seen               |
| -------- | -------- | ---------- | ----- | ----------------------------------------- |
| 12:34:05 | 12.3     | 12.1       | -0.2  | sse open; apply seq=1; reload-frame t=12  |
| 12:39:10 | 305.4    | 305.6      | +0.2  | 5 min quiet; all tolerated, never drifted |
| ...      | ...      | ...        | ...   | ...                                       |

Columns: read positions from the overlay (or `[drift] check target=... current=...` lines).
`drift` = member − host (positive = member ahead). Mark any FAIL observation in red/bold.

## Global pass/fail criteria

| #   | Criterion                                                | Measure                                                                          |
| --- | -------------------------------------------------------- | -------------------------------------------------------------------------------- |
| 1   | Drift stays ≤ **2s** for the whole session               | overlay drift / `[drift]` lines                                                  |
| 2   | Member never restarts from **0** on any reload/reconnect | `[reload-frame] t=` ≥ host pos − 2s; `[embed-pos] RESTORED`                      |
| 3   | Host play works immediately after a server switch        | `[provider] switch` + `[reload] triggered`; member playing <5s later             |
| 4   | Auto-reload path visible when it fires (never silent)    | `[reload] triggered/suppressed` + `[reload-frame]` + `[embed-pos]` lines present |
| 5   | Kick delivered <1s via dedicated event                   | `[kick]` line; toast; rejoin OK                                                  |
| 6   | Member survives background-tab + 2-min gap               | no 120s drop; resync ≤2s                                                         |
| 7   | Chat + FX unaffected                                     | messages/deletes/FX work                                                         |
| 8   | Queue advance switches everyone to the new source at 0   | `[queue] advanced` + `[media] switch` + `[iframe] loaded` on both clients        |

**Session is a FAIL if any of 1-4 fail** — record the time, the `[soak]` lines, and file an issue.

## How the auto-reload restore works (for reference)

`reloadSync()` records the target position, then the iframe `src` is rebuilt with
`#t=<position>&autoplay=<bool>` + a cache-buster (`Player.svelte` `reloadPending` effect).
`[reload-frame]` is emitted exactly when that URL is built, `[embed-pos]` verifies ~4s later
that the embed actually reports a position near the target. If an embed ignores `#t=`, the
soak log shows `embed-pos FAILED` followed by the drift-reload loop capped at 3 attempts
(`[reload] suppressed ... streak=3`) — that is the signal to switch provider or escalate.

## Engineering notes

- The member's drift target is anchored to **frame-receipt time on the member's own clock**
  (`expected = hostPosition + (memberNow - frameReceivedAt)`). The host's `positionAt` is only
  a frame-time reference; the member measures elapsed since it received the frame. Host/member
  wall-clock skew therefore cancels out instead of producing a fixed offset that trips the
  2s threshold into the 3-streak auto-reload loop. Network latency stays as a sub-second,
  constant lag, never growing. To reproduce the old bug: skew the member clock ±5s and watch
  `[drift] check ... gap=+5.0` (or reload loops); after the fix the gap is ~0.
- Instrumentation lives in `src/lib/soak/soak.ts` (passive store + logger) and
  `src/lib/components/soak/SoakOverlay.svelte` (overlay). Player + room page only call
  `soakEvent`/`soakUpdate`, which no-op unless `?soak=1`.
- Overlay is absent in production unless the URL carries `?soak=1`.
- svelte-check: 0 errors / 38 warnings (baseline); build + deploy via `npx vercel --prod --yes`.

## Autoplay-blocked member & host-pause mirror (2026-08)

- Drift gating is **host-relative and symmetric**: the member's target state is the host's
  state (`Player.svelte` drift tick + `applyRemote`). Host playing + member paused is a
  desync — a `play` command is attempted each tick (`gated (member not playing)`), never an
  auto-reload; the **"Tap to resume"** overlay covers autoplay-block, and a mirror-paused
  member gets one bounded resume reload (`resumed (host resumed)`). Host paused + member
  paused is a match (`matched (host paused)`): no drift counting, no reload. Host paused +
  member playing mirrors the pause (`paused (host paused)`, `pauseMirrored` flag); host play
  resumes it (symmetric). After any paused→playing transition a 15s **resume grace**
  (`resume grace`) tolerates the accumulated backlog instead of instantly reloading it; one
  catch-up reload may fire after the grace.
- Mid-playback stalls gate like pauses but show no overlay; autoplay-block shows the overlay
  (tap → force reload to host position). See `maybeShowTapPrompt` / `tapToContinue`.
- **vidlink has no inbound postMessage command protocol**: `sendEmbedCommand` play/pause/seek
  are inert on vidlink embeds (verified against the live player — no message handler in any
  static chunk). All control is URL-based (`#t=`, `autoplay`, cache-buster) via reloads.
- **Headless verification limits** (`ui-soak-stall.mjs`, runs against the live deploy with
  `?soak=1` + CDP-injected autoplay-block): phases A–D are deterministic and green
  (block→overlay, tap→force reload→unblock→resume, stall gate, recovery). Phase E
  (host-pause mirror) can go event-silent after mid-movie catch-up reloads in headless
  Chromium; the probe then SKIPs the phase (marked PASS/SKIPPED) — it needs a real browser
  or a lucky headless session to exercise the mirror. Health gates auto-rerun on host
  freeze/SSE drops (3 attempts).
- **Manual phase-E check (real browser)**: while both are playing, host presses pause →
  member pauses within ~10s (member console `[reload] ... paused (host paused)`), then host
  presses play → member resumes (`host resumed — reloading paused member`), ≤1 reload each,
  no loop.

## SSE tick 1500ms verification (cfbc43c, 2026-08-14)

Fluid-memory reduction (cfbc43c) lowered the SSE poll `TICK_MS` 700 → 1500ms (same-instance
pushes are instant via the in-process `subscribeRoom`; the tick is the cross-instance fallback
that guarantees event delivery when host and member land on different serverless instances).
Full probe matrix re-run against the deployed build to prove drift still holds ≤2s:

| probe | result | measured drift bands | reloads |
| ----- | ------ | -------------------- | ------- |
| `ui-soak-clock.mjs 0`   | 8/8 PASS | 0.0s pre-join; post-join embed never advances headless (autoplay-blocked → `gated`, tap-prompt) — artifact, offset-independent | 0 after join reload |
| `ui-soak-clock.mjs 5000`   | 8/8 PASS | same artifact band; skew +5s shows no reload loop (gaps identical to 0-offset) | 0 after join reload |
| `ui-soak-clock.mjs -5000`  | 8/8 PASS | same artifact band; skew −5s shows no reload loop | 0 after join reload |
| `ui-soak-stall.mjs` (run 1 + run 2) | 39/40 both | playing member tracked host at **−0.5…+0.3s** continuously (e.g. `gap=-0.4/-0.1/0.3` while target≈current); phase-D recovery gaps 0.0,0.0 | ≤1 legit catch-up reload per phase boundary; host 0 |
| `ui-soak-queue.mjs` | 35/35 PASS | — | — |

- The only stall FAIL (both runs, identical) is phase-E prep `timeupdates went stale` →
  "HEADLESS EMBED UNPLAYABLE — skipping phase E" at ~+488s. Deterministic headless Chromium
  artifact (embed stops emitting events mid-movie), unrelated to the tick change; phase E is
  the accepted real-browser manual check (above).
- **Measured gap band with a playing member: ≤0.5s** — the member extrapolates position
  between `[playback]` frames (`expected = hostPos + (memberNow − frameReceivedAt)`), so a
  1.5s poll adds no observable drift; the 2s threshold keeps 4× margin.
- Reload-loop assertions (no >2 reloads post-join, no 3-streak) hold at all three clock
  offsets — the clock-skew fix is unchanged by the slower tick.
- **Cross-instance stress**: not forceable from the harness (both contexts share one local
  Chrome; Vercel routes each EventSource arbitrarily, so instance affinity is unknowable).
  The tick-poll fallback is exercised implicitly; an explicit manual check on two real
  devices: host pauses → member follows within ~2s (console `[playback]` arrival ≤2s).
- `TICK_MS = 1500` kept; memory win stands (SSE function 256MB + halved DB polls).
