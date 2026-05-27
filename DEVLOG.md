# Quest Dashboard — Devlog

Project journal. Newest entries at the bottom. Each entry captures what shipped, key decisions, and gotchas worth remembering.

---

## 2026-05-18 — Inception, design, v1 build-out

### Scope decision: build, don't integrate

Started the day exploring whether to add a Google Tasks MCP server alongside the existing Obsidian + Gmail integrations. Quickly pivoted: instead of stitching MCPs into the IDE, build a standalone dashboard that pulls from the Obsidian kanban (and later, Google Tasks/Calendar). Reasoning: the value isn't *connecting* tools; it's a single, motivating view across them.

### Brainstorm → spec, in one sitting

Key design choices locked in:

- **Source**: a kanban-plugin board in an Obsidian vault (configurable via `config/sources.json`) for v1. Google Tasks → v2. Google Calendar → v3.
- **Bidirectional sync from day one** (not just a read-only viewer). Marking a quest complete in the dashboard rewrites the kanban file.
- **Sync adapter abstraction** baked into v1 even though only `ObsidianAdapter` exists. ~20% more upfront work; avoids a refactor when v2/v3 land.
- **Local server + browser frontend** model (Node + Express backend, Vite + React + Tailwind frontend). One process per surface; communicate via JSON over HTTP. Localhost only.
- **Cyberpunk HUD aesthetic** — dark neon, monospace, animated bars, scan-line hover. Wrote tokens directly into `tailwind.config.js`.
- **Auto XP scoring** from lane + emoji markers (🔥 +10, ⭐ +5, 🔺 +10, URGENT/TODAY +5). `#xpN` hashtag overrides auto. Subtasks have no individual XP — parent's XP fires only when parent's checkbox ticks.
- **Categories** mapped from kanban lanes: all `JOB SEARCH` lanes merge into "Job Hunt"; `DEV - *` lanes split per project; `TO DO - TODAY !` featured at top; `TO DO - BACKBURNER` rendered dim as "Side Quests"; `DONE - REVIEW` and `Archive` hidden.
- **Progress bars**: fixed daily/weekly XP goals (50/250 default) for the first 7 days, then auto-switch to rolling 7-day average. Fixed goal renders as a faint marker line ("ambition vs. average") in rolling mode.
- **Show/Hide Completed** toggle in header, default OFF, persisted in `localStorage`.
- **Conflict policy**: source-authoritative on read, last-write-wins on write. Append-only XP history log means no retroactive removals.
- **ID stability**: position-based (`obsidian:<file>:<lane>:<index>`), not text-based. Editing a title doesn't break the ID; reordering does (acceptable for a personal tool).

### Docs first

Committed 5 design docs at `aa23e6c` (PRD/SPEC/ARCH/USER-STORIES) and `2c72dfc` (IMPLEMENTATION-PLAN, ~4,500 lines of TDD-throughout tasks across 17 phases).

### Implementation — full v1 in one execution sprint

Used subagent-driven development: 1 implementer subagent per task with full task text + TDD steps in the prompt. ~40 commits across the day.

Phases shipped end-to-end:

1. **Workspace scaffold** (`c67e014`–`cb904d1`) — npm workspaces root, Express server, Vite/React/Tailwind client with cyberpunk theme tokens.
2. **Backend core** (`df2b005`–`5b6120c`) — Quest model, scoring (`computeXp` + `deriveFlags` + `stripXpTag`), category mapping, history store (JSONL append + date-windowed sums + rolling avg + dedupe + streak), advisory file lockManager.
3. **Parser** (`38e6b61`–`07dbc6d`) — kanban markdown parser handling lanes, top-level tasks, nested subtasks, `✅ YYYY-MM-DD` completion markers; plus `markLineComplete`/`titleMatches` write-back utilities.
4. **Adapters** (`4bb925a`–`75dd266`) — `SyncAdapter` abstract class + `ConflictError`; `ObsidianAdapter` with stable IDs, `obsidian://` deep links, lock-protected write-back, conflict detection on title mismatch.
5. **Aggregator + routes** (`6165ae0`–`debdd2b`) — `collectAll` orchestrating adapters → scoring → category mapping → sorting → completion diff detection → history events; HTTP routes for `/api/quests`, `POST /:id/complete` (with 409 + 404), `/api/history`, `/api/health`.
6. **Server bootstrap** (`0fbc482`) — `server/index.js` loads `config/sources.json` + `config/targets.json`, instantiates adapters from registry, mounts routes, serves `client/dist/` for prod mode.
7. **Frontend** (`389b545`–`383cb35`) — API client wrappers, `useQuests`/`useHistory`/`useShowCompleted` hooks, 11 components (XpBadge → FlagIcons → ObjectivesBar → ProgressBar → StreakBadge → ShowCompletedToggle → SyncIndicator → QuestCard → CompletedQuestCard → QuestModal → HeaderHUD → CategorySection), wired together in `App.jsx` with toasts, error states, empty states.
8. **First-run backfill** (`5a324a0`) — scans existing `✅ YYYY-MM-DD` markers and populates `xp-history.jsonl` so the dashboard has real history on first boot. Marker file at `data/.backfilled-<sourceId>` prevents re-runs.
9. **README** (`b780ab6`) — quick-start + config explanation.

### State at end of day
- 80 server tests + 25 client tests passing
- Production build verified
- Smoke test confirms `/api/health` and `/api/quests` work end-to-end against the fixture
- v1.0 functionally complete; manual browser smoke against real kanban deferred

### Gotcha worth remembering
The Remote Control orphan-tool-result issue hung a subagent during Task 5.1 (lock manager). When Remote Control is active and the connection blips mid tool-result, the subagent's tool call never returns. Workaround: kill the orphan, retry with the test file already in place as the RED step. Saved as a memory.

---

## 2026-05-25 — First browser run, dev script bug, v1.1 design

### Real-world smoke against the actual kanban

Backed up the real kanban file, repointed `config/sources.json` from the test fixture to it, cleared `data/.backfilled-obsidian` + `xp-history.jsonl`, restarted server. Backend reported **103 quests parsed across 7 categories** (including one lane that wasn't in the kanban at brainstorm time — fell through to fallback category mapping, rendered cleanly).

### Bug: dev server only served the backend

`npm run dev` showed only port 3000 listening; port 5173 was unreachable. Root cause: root `package.json` had `"dev": "npm run dev --workspaces --if-present"` which runs workspace scripts **sequentially**. The server's `node --watch index.js` blocks forever, so Vite never got its turn.

Fix at `2932207`: rewrote the root `dev` script to use `concurrently` (already declared as a devDep but never installed at root). Also ran `npm install` at the root to actually install it. Documented as a one-line script change + commit.

### v1.1 design: interactive subtasks

User noticed subtasks in the modal were read-only and asked how to tick them. Triggered a brainstorm.

Key choices:

- **Auto-complete parent when ALL subtasks done** (option B of three): ticking the last subtask atomically writes parent line + fires parent's XP. Server-side detection inside `ObsidianAdapter.markComplete` avoids client-side race conditions.
- **Parent "Mark Complete" button BLOCKED** when subtasks remain (option C of three): button is disabled with helper text until all objectives done. In practice this means clicking the last subtask is the de-facto "complete parent" action — the button itself is only ever used for parent-only quests.
- **No un-completing subtasks** via dashboard. Match parent behavior.
- **`<ObjectivesBar>` reused inside the modal** (above the subtask checklist) for live optimistic progress. Same component as on the QuestCard; no new variant.

Committed v1.1 spec (`a52bd44`) and v1.1 plan (`dc07fef`, ~1,300 lines, 8 TDD tasks).

---

## 2026-05-26 — v1.1 server + client implementation

Subagent-driven execution again. 7 of 8 tasks shipped.

### Backend (Tasks 1–4)

1. **Parser** (`9b8a9bc`) — `markLineComplete(line, dateStr?)` made date-optional (omitting it writes `- [x]` without ` ✅ <date>`, used for subtasks); new `areAllSubtasksComplete(lines, parentLine)` walks indented siblings, stops at next top-level task or lane header.
2. **Subtask sourceRef** (`da0b621`) — `ObsidianAdapter._buildQuest` populates `expectedTitle` on objective `sourceRef`s. Required so write-back can do the same title-match conflict check that parents already used.
3. **`markComplete` subtask branch** (`0a9bf5b`) — branches on `sourceRef.parentLine`. Subtask path: write subtask line without date, then check `areAllSubtasksComplete`; if true, also rewrite the parent line with today's date. Returns `{ parentCompleted, parentLine }` so the route knows whether to emit a parent XP event. Atomic — single file write per call.
   - **Subtle test fix**: my plan's first test assumed `parentCompleted: false` after writing "Subtask one" — but the fixture has "Subtask two" already complete, so writing "one" IS the last incomplete. The implementer corrected the assertion to `true` and shipped. Left a minor coverage gap (the non-transitive subtask path isn't separately tested by integration; it IS exercised by Task 4's route tests).
4. **Actions route** (`ca8e6ec`) — extends quest lookup to recurse one level into `objectives[]` so subtask IDs resolve; returns `422 { error: 'subtasks_incomplete', remaining }` when a parent with incomplete subtasks is targeted; emits exactly ONE parent XP history event when `markResult.parentCompleted: true`.

### Client (Tasks 5–7)

5. **`postComplete` 422 handler** (`26f6b4f`) — throws a typed error `{ code: 'SUBTASKS_INCOMPLETE', remaining }` on 422 (parallel to the existing `CONFLICT` on 409).
6. **QuestModal rewrite** (`451764a`) — local `liveObjectives` state for optimistic ticking; `<ObjectivesBar>` rendered above the subtask `<ul>`; each unchecked subtask is a `<button>` that calls `onObjectiveComplete(subtask)` + optimistically marks itself done; completed subtasks render as static struck-through text; parent "Mark Complete" button disabled when `hasObjectives && !allDone`, with helper text "Complete all objectives first" below.
   - **Implementer adjustment**: the helper text originally included `({done}/{total})`, which collided with the same fraction in `<ObjectivesBar>` and broke `getByText(/N\/M/)` matchers. Implementer trimmed the count out of the helper (the fraction is already visible in the bar). Acceptable UX trade-off.
7. **App.jsx wiring** (`742734b`) — passes `onObjectiveComplete={handleObjectiveComplete}` to `QuestModal`. Handler logic: if `res.parentCompleted` is true → close modal + big XP toast + refetch; otherwise small "Objective complete: …" toast + background refetch. Generic `handleComplete` (parent button path) also handles the new `SUBTASKS_INCOMPLETE` error (shouldn't fire from UI since button is disabled, but the API contract is honest).

### State end of day
- 95 server tests + 33 client tests passing
- v1.1 done end-to-end; just verification + doc cross-links left

---

## 2026-05-27 — v1.1 verification, port change

### Verification + doc cross-links (`1270bf7`)

Confirmed 95+33 tests still green, production build succeeds. Added cross-links: `SPEC.md` now points to `SPEC-v1.1-subtasks.md` ("See also"); `IMPLEMENTATION-PLAN.md` points to `IMPLEMENTATION-PLAN-v1.1-subtasks.md` ("v1.1 follow-on").

Skipped the plan's HTTP smoke test step — duplicative with supertest route tests, and would have disrupted the running dev server. Browser smoke is for the user.

### Dev port: 5173 → 5274 (`8a32f87`)

Another local project also uses 5173 and has priority. Updated `client/vite.config.js` to bind Vite on **5274**. Vite's config-file watcher detected the change and rebound automatically — no manual restart needed.

Backend remains on **3000**. The Vite → backend proxy is unchanged.

### DEVLOG + project CLAUDE.md (`83e8fbb`, `782e5a5`)

Captured the full project arc to date in `DEVLOG.md` (this file) — chronological entries from inception through v1.1 plus a "Known quirks / tech debt" section.

Added `CLAUDE.md` at the project root codifying the rule "update DEVLOG.md after every non-cosmetic commit". Sister memory saved at `~/.claude/projects/.../memory/feedback_devlog_after_commit.md` so the same instruction loads at session start. Noted the upgrade path (PostToolUse hook via the `update-config` skill) for hard enforcement if the soft approach drifts.

### GitHub remote created → sanitized → public

Created **https://github.com/dreemanuel/obsidian-quest-dashboard** via `gh repo create` — initially **private** while a sanitization pass ran. Both `main` (the initial 2 docs commits) and `feature/v1-implementation` (the full development history) pushed. SSH protocol, default branch `main`.

A dedicated `public-prep` branch hosted the sanitization work — 5 commits:

- `11d6e00` — genericized lane defaults in `scoring.js` + `categoryMap.js` (generic `/^DEV - /` rule replaces hardcoded project names; behavior preserved); tests updated
- `278f320` — `config/sources.example.json` gets placeholder path + vault name
- `f679500` — bulk sweep across all design docs replacing paths, vault name, project names, and personal narrative references
- `15527ba` — DEVLOG specific sanitizations (`ObsMain` path, specific new-lane name, backup filename)
- `9d05489` — README expanded with a "What it looks like" overview, an "Adapting the lane rules to YOUR kanban" section, the modifier table, and `#xpN` override docs

Verified: 95 server + 33 client tests passing, production build clean, zero remaining personal-term mentions in tracked files. MIT LICENSE added. `public-prep` merged into `main` (fast-forward) and the repo flipped to **public**.

### Discoverability: GitHub topics

Applied 15 topics to the public repo for ecosystem discovery: `obsidian`, `obsidian-kanban`, `kanban`, `productivity`, `dashboard`, `gamification`, `rpg`, `cyberpunk`, `task-management`, `local-first`, `bidirectional-sync`, `markdown`, `react`, `nodejs`, `tailwindcss`. Leaves 5 slots open (of GitHub's 20-topic max).

### Production validation

User loaded their real Obsidian kanban (103 quests, 7 categories) and exercised the v1.1 subtask flow on a heavily-nested item ("Google CySec Tasks:" with 17 objectives). Parent's "Mark Complete" button correctly disabled with "COMPLETE ALL OBJECTIVES FIRST" helper; objective progress bar reflects 1/17 (one historically completed via Obsidian). Rolling-avg mode is already in effect from backfilled history (daily target dynamically computed from the past 7 days of XP) — confirms SPEC §5.2's "Day 7+" rolling baseline switch is firing correctly.

### Backend port collision (`000fb7f`)

User opened `http://localhost:5274/` and saw "SYNC FAILURE: fetchQuests failed: 404". Root cause: another local project (Remix-based) had taken port 3000. The dashboard's Vite proxy was still forwarding `/api/*` to `localhost:3000`, hitting the Remix app, which returned its default 404 page (recognized by the `💿 Hey developer 👋` console-log string in the HTML).

Fix: move our backend to **3274** (pairing nicely with the client's **5274**, same last 3 digits). Updated `server/index.js` default `PORT` and `client/vite.config.js` proxy target. Killed all orphaned quest-dashboard dev processes (an earlier `npm run dev` had left stale `node --watch` instances unable to acquire 3000 after Remix grabbed it). Restarted fresh.

`config/sources.json` and the running Remix project on 3000 were untouched.

### v1.2 onboarding — spec + plan (`dcfc4eb`, `a4c216c`)

Brainstormed and committed the v1.2 design: a first-run onboarding wizard + reusable Settings page for adding/removing kanban sources via the UI, replacing the v1 hand-edit-JSON-and-restart flow.

Locked design decisions:
- **Custom server-side file/folder browser** (server exposes a path-listing endpoint constrained to `$HOME`; frontend builds the UI). Rejected text-input-only and File-System-Access-API approaches.
- **Frontmatter `kanban-plugin: board` check** as the detection criterion when scanning a vault. Non-kanban `.md` files in the file browser render greyed out / unselectable.
- **Both first-run AND Settings re-entry** via a ⚙ button in the header HUD. Same `OnboardingFlow` component for both modes.
- **Vault name auto-detected** by walking up to the nearest `.obsidian/` ancestor; user can override per-source in the review step.
- **Hot-reload of adapters** on save — no server restart. Aggregator gets a new `replaceAdapters` method.
- **Server boot becomes resilient** to missing `config/sources.json` (currently fatal); empty config is valid first-run state.

Spec: `docs/SPEC-v1.2-onboarding.md` (362 lines). Plan: `docs/IMPLEMENTATION-PLAN-v1.2-onboarding.md` (3,335 lines, 24 TDD tasks across 8 phases).

### v1.3 activity tracker — shipped on `feature/v1.3-activity-tracker`

GitHub-style 7×13 activity grid below the streak/rolling-avg line in the header HUD. 91 tiles spanning the last ~90 days (week-aligned, ending the upcoming Saturday). Each tile's opacity buckets relative to the daily XP target:
- bucket 0 (no activity): `hud-border` at 30% opacity
- bucket 1 (1–25% of target): `hud-accent` at 25%
- bucket 2 (25–75%): `hud-accent` at 50%
- bucket 3 (75–125%, around-goal): `hud-accent` at 75%
- bucket 4 (>125%, goal smashed): `hud-accent` at full opacity

Native `title` attribute on each tile shows `YYYY-MM-DD — N XP` (or `(future)` for tiles beyond today's date).

4 commits across 5 plan tasks (Task 5 was verification only):
- `470e20e` — `historyStore.dailyXpByDate(start, end)` aggregates XP per ISO date
- `bf4492f` — `GET /api/history` extended with 91-entry `dailyActivity` array, oldest first, ending upcoming Saturday
- `a591403` — `ActivityTracker` component (CSS grid with `gridAutoFlow: 'column'` + 7 explicit rows)
- `53be54d` — wired into `HeaderHUD` with defensive `history?.dailyActivity &&` guard

Verified: 141 server + 71 client = 212 tests passing. Production build clean (171 KB JS / 13 KB CSS pre-gzip).

### v1.2 onboarding — implementation shipped on `feature/v1.2-onboarding`

23 implementation commits across the 24-task plan (Task 24 = final verification, no new code). All TDD: RED → GREEN → commit. Subagent-driven execution.

Backend (`3f89e35` → `683c5ed`):
- `pathGuard.assertPathSafe` — home-dir containment, symlink resolution, traversal rejection
- `configWriter.writeSourcesConfig` — atomic `.tmp` + rename
- `configLoader` resilience — empty sources when `sources.json` missing (instead of throwing)
- `aggregator.replaceAdapters` — hot-reload without server restart
- `vaultScanner` — frontmatter-based kanban detection + `inferVaultName` walk-up, with `.obsidian/` + hidden-dirs + `node_modules/` skips, 5000-file soft cap
- 4 setup routes: `GET /status`, `GET /browse` (files + folders modes), `POST /scan-vault`, `POST /save-sources` (with validation, dedup, hot-reload)
- Bootstrap: graceful empty-config boot + `setupNeeded` flag in `/api/quests` meta

Client (`fc42725` → `941f9bc`):
- `setupApi.js` wrappers + `useSetupStatus` hook
- 9 onboarding components in `client/src/components/onboarding/`: `BrowserRow`, `ModePicker`, `ExistingSourcesList`, `FileBrowser`, `FolderBrowser`, `ScanProgress`, `ChecklistReview`, `ConfirmLoading`, `OnboardingFlow` (state-machine wizard shell)
- `useQuests` updated to expose `setupNeeded`
- `HeaderHUD` gets ⚙ Settings button
- `App.jsx` conditionally renders `<OnboardingFlow>` when `setupNeeded` true OR Settings clicked; handles add + remove sources via the same flow

Verified: 133 server + 64 client = 197 tests passing. Production build clean (170 KB JS / 13 KB CSS pre-gzip). Branch pushed to `origin/feature/v1.2-onboarding`. Browser smoke test pending user.

Notable subagent self-corrections:
- BrowserRow tests had `MyVault` entry colliding with `(vault)` badge in `getByText(/vault/i)` — renamed to `MyNotes`
- FolderBrowser had the same collision — renamed to `MyKanban`

### v1.2 production validation

End-to-end browser smoke on the real Obsidian vault completed cleanly:
- Onboarding wizard appeared on first-run (with `config/sources.json` moved aside)
- User clicked "Scan a vault folder", navigated the folder browser to their real vault, picked it, hit "Scan →"
- Scanner detected 2 kanban board files in the vault; user kept 1, unchecked the other in the review checklist
- Confirm → save-sources POST returned 200 → adapters hot-reloaded → dashboard rendered with quests from the selected board

Notable surface issue surfaced + fixed during testing: ModePicker card heights were uneven in Firefox/Zen specifically. Took three iterations (`fffba3e` h-full → `4ac58d9` flex-1 → `c92dbbe` button as flex container) because the underlying cause was a Firefox `<button>` quirk where buttons don't honor `align-items: stretch` unless they're themselves flex containers. Chromium showed equal heights from the first fix; Zen needed the third. Browser-cache stickiness in Zen (Ctrl+Shift+R didn't bust it) also slowed diagnosis.

### v1.2 polish (`fffba3e`)

User browser-smoke-tested the onboarding flow and reported the two mode-pick cards had uneven heights — the shorter "Pick specific file(s)" card looked jarring next to the taller "Scan a vault folder" one. Root cause: grid cells stretched to match the taller card, but each button only sized to its own content. Fix: `h-full` on both `<button>` elements so they fill their grid cells; shorter card now has natural empty space below its body text.

---

## Current state (2026-05-27)

- **Branch**: `feature/v1-implementation` (57 commits ahead of `main`)
- **Tests**: 141 server + 71 client = 212 passing
- **Production build**: succeeds, ~155 KB JS + 12 KB CSS
- **Dev URLs**: `http://localhost:5274/` (frontend), `http://localhost:3274/api/*` (backend)
- **Source**: the maintainer's Obsidian kanban file (configured locally; not part of the repo)
- **Backups**: always recommended — copy your kanban file to a timestamped `.bak` before the first dashboard write-back run
- **Not yet done**:
  - v1.0.0 tag (waiting on user-validated end-to-end success)
  - Merge `feature/v1-implementation` → `main`
  - v2 (Google Tasks integration + live file watcher)
  - v3 (Google Calendar)

## Known quirks / tech debt

- **Stray file `" "` at repo root** — a 21 KB file literally named with a single space, containing a snapshot of the real kanban. Created accidentally by a malformed heredoc somewhere. Untracked. Decide whether to keep / rename / delete.
- **`.bak` files accumulating** — per the personal CLAUDE.md backup convention, every file edit also creates a `.bak`. They're untracked but cluttering. A periodic cleanup pass is fine.
- **Remote Control orphan-tool-result** — long autonomous runs can hang when the connection blips mid tool-result. Documented as a personal memory; mitigation is to disable Remote Control before long subagent sprints.
- **Backfilled XP from existing `✅` markers shows `xp: 0`** — adapter's `listQuests` returns quests without scoring (scoring runs in the aggregator). Backfill uses `listQuests` directly. Historical XP from pre-existing completions doesn't count toward daily/weekly bars. Acceptable: new completions through the dashboard award proper XP. Could be fixed by running the same scoring pipeline during backfill.
- **Test coverage gap (v1.1)**: the "subtask completed but parent NOT auto-completed because other subtasks are incomplete" branch isn't tested in isolation (the fixture only has one incomplete subtask under "Personal task"). The branch IS exercised indirectly. A future test could use a scratch fixture with 2+ incomplete subtasks.
- **Position-based IDs** invalidate on lane reorder. XP history orphans (still count toward totals via timestamps, but the live card maps to a "new" quest). Acceptable for a personal tool.
- **No file watching** — dashboard polls every 60s. Changes in Obsidian take up to a minute to reflect. Manual refresh button is always available. Live file-watch via chokidar + WebSocket is on the v2 roadmap.
