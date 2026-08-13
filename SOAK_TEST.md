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

**Session is a FAIL if any of 1-4 fail** — record the time, the `[soak]` lines, and file an issue.

## How the auto-reload restore works (for reference)

`reloadSync()` records the target position, then the iframe `src` is rebuilt with
`#t=<position>&autoplay=<bool>` + a cache-buster (`Player.svelte` `reloadPending` effect).
`[reload-frame]` is emitted exactly when that URL is built, `[embed-pos]` verifies ~4s later
that the embed actually reports a position near the target. If an embed ignores `#t=`, the
soak log shows `embed-pos FAILED` followed by the drift-reload loop capped at 3 attempts
(`[reload] suppressed ... streak=3`) — that is the signal to switch provider or escalate.

## Engineering notes

- Instrumentation lives in `src/lib/soak/soak.ts` (passive store + logger) and
  `src/lib/components/soak/SoakOverlay.svelte` (overlay). Player + room page only call
  `soakEvent`/`soakUpdate`, which no-op unless `?soak=1`.
- Overlay is absent in production unless the URL carries `?soak=1`.
- svelte-check: 0 errors / 38 warnings (baseline); build + deploy via `npx vercel --prod --yes`.
