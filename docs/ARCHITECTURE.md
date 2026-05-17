# Quest Dashboard — Architecture

**Version**: 1.0 (v1 MVP)
**Date**: 2026-05-18
**Companion docs**: [PRD.md](PRD.md), [SPEC.md](SPEC.md), [USER-STORIES.md](USER-STORIES.md)

This document covers the technical design: stack, project layout, sync adapter pattern, data flow, and extension points for v2/v3.

---

## 1. Tech Stack

| Layer | Choice | Why |
|---|---|---|
| Backend runtime | Node.js (LTS) | Andre's existing JS proficiency; one language across stack |
| Backend framework | Express | Minimal, well-known, sufficient for ~6 endpoints |
| Frontend build | Vite | Fast dev server, modern, zero-config React setup |
| Frontend framework | React | Andre's existing skill; component model fits dashboard cleanly |
| Styling | Tailwind CSS + custom CSS | Tailwind for layout + utility; custom CSS for cyberpunk animations (scan-lines, glitch, neon) |
| Storage | Flat files (JSON + JSONL) | No DB needed for personal single-user tool |
| Markdown parsing | Custom parser (handwritten) | Obsidian kanban format is small and specific; off-the-shelf parsers are too generic |

**Rejected alternatives**:
- Next.js: overkill for a local-only app with no SSR/routing complexity
- Python/Flask: doesn't leverage Andre's existing skills
- SQLite: unnecessary for the scale (single user, <1000 quests, append-only history)

## 2. Project Structure

```
quest-dashboard/
├── server/                            # Node + Express backend
│   ├── index.js                       # boots Express, mounts routes
│   ├── adapters/
│   │   ├── SyncAdapter.js             # interface (abstract class or duck-typed)
│   │   └── ObsidianAdapter.js         # v1 implementation
│   ├── core/
│   │   ├── questModel.js              # Quest schema + helpers
│   │   ├── scoring.js                 # XP calculation rules
│   │   ├── categoryMap.js             # lane → category mapping
│   │   ├── aggregator.js              # orchestrates adapters, normalizes output
│   │   ├── historyStore.js            # read/append xp-history.jsonl
│   │   └── lockManager.js             # advisory file locking
│   ├── routes/
│   │   ├── quests.js                  # GET /api/quests
│   │   ├── actions.js                 # POST /api/quests/:id/complete
│   │   ├── history.js                 # GET /api/history
│   │   └── health.js                  # GET /api/health
│   └── parsers/
│       └── kanbanMarkdown.js          # parses & writes Obsidian kanban-plugin markdown
├── client/                            # Vite + React + Tailwind frontend
│   ├── index.html
│   ├── src/
│   │   ├── main.jsx
│   │   ├── App.jsx
│   │   ├── components/
│   │   │   ├── HeaderHUD.jsx
│   │   │   ├── ProgressBar.jsx
│   │   │   ├── StreakBadge.jsx
│   │   │   ├── ShowCompletedToggle.jsx
│   │   │   ├── SyncIndicator.jsx
│   │   │   ├── CategorySection.jsx
│   │   │   ├── QuestCard.jsx
│   │   │   ├── CompletedQuestCard.jsx
│   │   │   ├── ObjectivesBar.jsx
│   │   │   ├── FlagIcons.jsx
│   │   │   ├── XpBadge.jsx
│   │   │   └── QuestModal.jsx
│   │   ├── hooks/
│   │   │   ├── useQuests.js           # fetch + revalidate via polling
│   │   │   ├── useHistory.js          # fetch XP history
│   │   │   └── useShowCompleted.js    # toggle state + localStorage persistence
│   │   ├── lib/
│   │   │   ├── api.js                 # fetch wrappers for backend API
│   │   │   └── animations.js          # XP gain count-up, glitch helpers
│   │   └── styles/
│   │       ├── index.css              # Tailwind imports + custom CSS
│   │       └── cyberpunk.css          # neon, scan-lines, glitch keyframes
│   └── tailwind.config.js
├── config/                            # git-ignored — personal state
│   ├── sources.json                   # which adapters active + config
│   ├── targets.json                   # daily/weekly XP goals
│   └── categoryMap.json               # optional lane → category overrides
├── data/                              # git-ignored — personal data
│   ├── xp-history.jsonl               # append-only completion log
│   └── .backfilled-obsidian           # first-run marker
├── package.json
├── README.md
└── .gitignore
```

**Why this shape**:
- `server/adapters/` is the load-bearing abstraction. New sources = new files here, zero changes elsewhere.
- `server/core/` is source-agnostic — same scoring/category logic regardless of source.
- `server/parsers/` isolates source-format-specific code so adapters stay focused on the SyncAdapter contract.
- `client/` and `server/` are fully separated, communicating only via JSON over HTTP.
- `config/` and `data/` are git-ignored so the code stays portable; personal state stays personal.

## 3. SyncAdapter Pattern

The core extensibility primitive.

### 3.1 Interface

```js
// server/adapters/SyncAdapter.js
class SyncAdapter {
  /** @returns {string} Stable source identifier, e.g. "obsidian" */
  getId() { throw new Error("not implemented"); }

  /** @returns {Promise<Quest[]>} Full current quest list from the source */
  async listQuests() { throw new Error("not implemented"); }

  /** @param {object} sourceRef Adapter-specific reference (e.g., {file, line}) */
  /** @returns {Promise<void>} */
  async markComplete(sourceRef) { throw new Error("not implemented"); }

  /** @returns {Promise<{status: 'ok'|'error', lastError?: string}>} */
  async healthCheck() { throw new Error("not implemented"); }
}
```

### 3.2 v1: ObsidianAdapter

```js
// server/adapters/ObsidianAdapter.js
class ObsidianAdapter extends SyncAdapter {
  constructor(config) {
    this.file = config.file;       // absolute path to kanban .md
    this.vault = config.vault;     // for obsidian:// deeplink generation
  }

  async listQuests() {
    const raw = await fs.readFile(this.file, 'utf8');
    const board = kanbanParser.parse(raw);
    return board.lanes.flatMap(lane => this.normalizeQuests(lane));
  }

  async markComplete(sourceRef) {
    await lockManager.acquire(this.file);
    try {
      const raw = await fs.readFile(this.file, 'utf8');
      const lines = raw.split('\n');
      const targetLine = lines[sourceRef.line];

      // Defensive verification
      if (!this.titleMatches(targetLine, sourceRef.expectedTitle)) {
        throw new ConflictError('quest_changed');
      }

      // Write back: - [ ] X → - [x] X ✅ YYYY-MM-DD
      lines[sourceRef.line] = this.markLineComplete(targetLine);
      await fs.writeFile(this.file, lines.join('\n'));
    } finally {
      await lockManager.release(this.file);
    }
  }

  async healthCheck() {
    try {
      await fs.access(this.file, fs.constants.R_OK | fs.constants.W_OK);
      return { status: 'ok' };
    } catch (err) {
      return { status: 'error', lastError: err.message };
    }
  }
}
```

### 3.3 v2/v3: GoogleTasksAdapter, GoogleCalendarAdapter

Same interface, different backing API. Configuration in `sources.json` activates them. Aggregator and frontend require no changes.

## 4. Data Flow Diagrams

### 4.1 Read Flow

```
┌──────────┐  GET /api/quests  ┌──────────────┐
│ Frontend │──────────────────▶│ routes/quests│
└──────────┘                   └──────┬───────┘
     ▲                                │
     │                                ▼
     │                         ┌──────────────┐
     │                         │  aggregator  │
     │                         └──────┬───────┘
     │                                │
     │                  ┌─────────────┼─────────────┐
     │                  ▼             ▼             ▼
     │           ┌────────────┐ ┌────────────┐ ┌────────────┐
     │           │ Obsidian   │ │ (future)   │ │ (future)   │
     │           │ Adapter    │ │ GTasks     │ │ GCal       │
     │           └─────┬──────┘ └────────────┘ └────────────┘
     │                 │ Quest[]
     │                 ▼
     │           ┌──────────────┐
     │           │  scoring +   │
     │           │  categoryMap │
     │           └──────┬───────┘
     │                  │
     │                  ▼
     │           ┌──────────────┐
     │           │ diff vs prev │──▶  appends new completions
     │           │ snapshot     │    to xp-history.jsonl
     │           └──────┬───────┘
     │                  │
     │  {quests, meta}  │
     └──────────────────┘
```

### 4.2 Write Flow

```
User clicks "Mark Complete"
         │
         ▼
┌──────────────────────┐
│ POST /api/quests/:id │
│      /complete       │
└──────────┬───────────┘
           │
           ▼
   ┌──────────────┐
   │ routes/      │  lookup quest by ID in aggregator cache (or refetch)
   │ actions      │
   └──────┬───────┘
          │
          ▼
   ┌──────────────┐  acquire(.lock)
   │ adapter      │  → re-read source
   │ markComplete │  → verify title matches (defensive)
   │              │  → write back
   │              │  release(.lock)
   └──────┬───────┘
          │
          ▼
   ┌──────────────┐
   │ historyStore │  append XP event to xp-history.jsonl
   │ append       │
   └──────┬───────┘
          │
          ▼
   ┌──────────────┐
   │ response:    │
   │ {success,    │
   │  quest, xp}  │
   └──────────────┘
          │
          ▼
Frontend: optimistic UI → XP animation → background refetch
```

## 5. Aggregator Design

`server/core/aggregator.js` is the orchestration layer between adapters and the API:

```js
class Aggregator {
  constructor(adapters, historyStore) {
    this.adapters = adapters;        // [SyncAdapter, ...]
    this.historyStore = historyStore;
    this.previousSnapshot = null;    // for completion diff detection
  }

  async collectAll() {
    const sourceResults = await Promise.allSettled(
      this.adapters.map(a => a.listQuests())
    );

    const quests = [];
    const sourceMeta = [];

    for (const [i, result] of sourceResults.entries()) {
      const adapter = this.adapters[i];
      if (result.status === 'fulfilled') {
        const scored = result.value
          .map(q => scoring.compute(q))
          .map(q => ({ ...q, category: categoryMap.apply(q) }));
        quests.push(...scored);
        sourceMeta.push({ id: adapter.getId(), status: 'ok', questCount: scored.length });
      } else {
        sourceMeta.push({ id: adapter.getId(), status: 'error', error: result.reason.message });
      }
    }

    // Detect new completions vs. last snapshot
    if (this.previousSnapshot) {
      const newCompletions = this.detectCompletions(this.previousSnapshot, quests);
      await this.historyStore.appendBatch(newCompletions);
    }
    this.previousSnapshot = quests;

    return { quests: this.sort(quests), meta: { sources: sourceMeta } };
  }
}
```

**Key properties**:
- `Promise.allSettled` ensures one failing source doesn't block others
- Each adapter's quests pass through the same scoring/category pipeline regardless of source
- Completion diff is centralized — adapters don't need to track state

## 6. Storage Strategy

| File | Format | Purpose |
|---|---|---|
| `data/xp-history.jsonl` | JSONL (newline-delimited JSON) | Append-only completion log; powers progress bars + streak |
| `data/.backfilled-<sourceId>` | empty marker file | Prevents re-running historical backfill |
| `config/sources.json` | JSON | Adapter activation + per-source config |
| `config/targets.json` | JSON | Fixed XP goals |
| `config/categoryMap.json` | JSON | Optional category rule overrides |

**Why JSONL for history**:
- Append-only is crash-safe (no in-memory state to flush)
- Trivial to parse line by line for date-range queries
- Future export/import is straightforward
- No schema migrations needed for a single-user tool

## 7. Locking Strategy

`server/core/lockManager.js` implements simple advisory file locking:

- Lock file: `.<targetFile>.lock` next to the target
- Contains: `{ pid, acquiredAt }`
- Acquire: create lock file with `O_EXCL`; if exists and `acquiredAt` is >5s old, force-acquire (assume stale)
- Release: delete lock file
- Used by `ObsidianAdapter.markComplete` to serialize writes

This is *enough* for single-user single-process scenarios. Not safe across multiple OS processes writing the same file, but that's not a v1 concern.

## 8. Polling & Refresh Strategy (v1)

- **Initial fetch**: on page mount
- **Background poll**: every 60s (configurable per source in `sources.json`)
- **Post-action refresh**: after `POST /complete` succeeds, immediate background refetch
- **Manual refresh**: header HUD button triggers fetch

**v2 upgrade**: replace polling with WebSocket push from a `chokidar`-based file watcher. Backend pushes "data changed" events; frontend refetches on receipt.

## 9. Build & Run Modes

### 9.1 Development
```bash
npm run dev      # boots Vite dev server (5173) + Express backend (3000) concurrently
# Vite proxies /api/* to localhost:3000
```

### 9.2 Production (local daily use)
```bash
npm run build    # Vite builds client/ → client/dist/
npm start        # Express serves API + static dist/ on a single port (e.g., 3000)
```

A desktop shortcut or systemd user service can be added later to auto-start on login.

## 10. Error Handling Philosophy

- **Source errors**: degrade gracefully; show banner; preserve last good cache; don't crash backend
- **Write conflicts**: return 409 with structured error; frontend shows toast + auto-refresh
- **Parse failures**: log warning, skip malformed task, continue parsing remaining
- **Network errors (frontend)**: show banner, retain cached data, disable write actions until reconnect

## 11. Logging

- Backend: structured console logs (`{level, ts, msg, ...context}`)
- Levels: error (operational failures), warn (recoverable), info (lifecycle), debug (verbose)
- No log files in v1 — stdout only; user can pipe to a file if desired

## 12. Future Extension Points (v2 / v3)

| Extension | Where the change goes | Lines of code estimate |
|---|---|---|
| Add `GoogleTasksAdapter` | New file in `server/adapters/`; add entry to `sources.json` | ~200 |
| Add `GoogleCalendarAdapter` | Same; plus new `QuestTimeline` component in frontend | ~300 + ~100 frontend |
| Replace polling with file watcher | `server/index.js` adds chokidar; new WebSocket route; frontend `useQuests` uses WS instead of polling | ~80 |
| Conflict UI | New `<ConflictBanner>` component; aggregator returns conflict metadata | ~100 |
| Achievements (v4) | New `server/core/achievements.js`; reads `xp-history.jsonl`; new API endpoint; new frontend component | ~250 |

The architecture is designed so each of these is **additive** — no existing files need restructuring.

## 13. Testing Strategy (recommended for v1)

- **Unit**: `scoring.js`, `categoryMap.js`, `kanbanMarkdown` parser, `historyStore` (pure functions / file IO with temp dirs)
- **Integration**: `ObsidianAdapter` against a fixture markdown file
- **Manual**: end-to-end smoke test of read → display → mark complete → verify file written

Test runner: Vitest (works for both Node and React code; same config as Vite).

## 14. Security Notes

- Backend binds to `localhost` only (not `0.0.0.0`); not exposed to LAN
- No authentication in v1 (single-user, localhost)
- No data leaves the machine; all sources are local in v1
- v2+ Google integrations will use OAuth tokens stored in `data/` with `0600` permissions
