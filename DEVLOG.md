# Quest Dashboard — Devlog

Project journal. Newest entries at the bottom. Each entry captures what shipped, key decisions, and gotchas worth remembering.

---

## 2026-05-18 — Inception, design, v1 build-out

### Scope decision: build, don't integrate

Started the day exploring whether to add a Google Tasks MCP server alongside the existing Obsidian + Gmail integrations. Quickly pivoted: instead of stitching MCPs into the IDE, build a standalone dashboard that pulls from the Obsidian kanban (and later, Google Tasks/Calendar). Reasoning: the value isn't *connecting* tools; it's a single, motivating view across them.

### Brainstorm → spec, in one sitting

Key design choices locked in:

- **Source**: `~/Documents/ObsMain/_TASKS & REMINDERS/& DAILY TO DO.md` (kanban-plugin board) for v1. Google Tasks → v2. Google Calendar → v3.
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

Backed up `& DAILY TO DO.md`, repointed `config/sources.json` from the test fixture to the real file, cleared `data/.backfilled-obsidian` + `xp-history.jsonl`, restarted server. Backend reported **103 quests parsed across 7 categories** (including one new lane `JWCE` that wasn't in the kanban at the time of brainstorm — fell through to fallback category mapping, rendered cleanly).

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

---

## Current state (2026-05-27)

- **Branch**: `feature/v1-implementation` (43 commits ahead of `main`)
- **Tests**: 95 server + 33 client = 128 passing
- **Production build**: succeeds, ~155 KB JS + 12 KB CSS
- **Dev URLs**: `http://localhost:5274/` (frontend), `http://localhost:3000/api/*` (backend)
- **Source**: real Obsidian kanban at `~/Documents/ObsMain/_TASKS & REMINDERS/& DAILY TO DO.md`
- **Backups**: pre-dashboard kanban backed up at `& DAILY TO DO.md.bak.pre-qd-20260525-184421` (21,215 bytes)
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
