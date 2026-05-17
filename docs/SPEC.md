# Quest Dashboard — Specification

**Version**: 1.0 (v1 MVP)
**Date**: 2026-05-18
**Companion docs**: [PRD.md](PRD.md), [ARCHITECTURE.md](ARCHITECTURE.md), [USER-STORIES.md](USER-STORIES.md)

This document defines precise feature behavior, data shapes, scoring rules, and the HTTP API. It is the contract the implementation must satisfy.

---

## 1. Canonical Quest Schema

Every adapter normalizes its source data into this shape. The aggregator, scoring, and frontend operate exclusively on `Quest` objects.

```ts
interface Quest {
  id: string;                    // stable, source-prefixed ID
  sourceId: "obsidian" | "gtasks" | "gcal";  // adapter origin
  sourceRef: object;             // adapter-specific reference (file+line for Obsidian)
  title: string;                 // user-facing title (hashtag overrides stripped)
  rawTitle: string;              // original title before stripping
  category: string;              // mapped category, e.g. "Job Hunt"
  rawLane: string;               // source's original lane/list name
  xp: number;                    // computed XP value
  xpSource: "auto" | "tag";      // how XP was derived
  flags: ("urgent" | "starred" | "critical")[];  // from emoji
  completed: boolean;
  completedAt: string | null;    // ISO 8601 if completed
  objectives: Quest[];           // nested subtasks (recursive)
  objectiveProgress: {
    done: number;
    total: number;
  };
  deepLink: string;              // e.g. obsidian:// URI to source location
  notes: string | null;          // any free-text body associated with the quest
}
```

**ID format** (v1):
- Obsidian: `obsidian:<file-slug>:<lane-slug>:<position-within-lane>`
  - Example: `obsidian:daily-todo:job-search-this-week:0`
- Future adapters MUST prefix with their `sourceId` to guarantee global uniqueness.

**ID stability**:
- Position-based, NOT text-based. Editing a task title does NOT change its ID.
- Reordering tasks within a lane DOES invalidate IDs — acceptable trade-off (see [PRD.md §11](PRD.md#11-risks--open-questions)).

## 2. XP Scoring Rules (v1)

### 2.1 Hashtag Override (highest precedence)

If the task title contains a tag matching `#xp(\d+)`, use that number as the XP value:
- Tag is stripped from `title` (preserved in `rawTitle`)
- `xpSource` is set to `"tag"`
- Modifiers (§2.3) are NOT applied to overridden values
- Examples: `#xp10`, `#xp25`, `#xp100`

### 2.2 Auto Base XP by Lane

When no `#xpN` tag is present, base XP is derived from the source lane:

| Lane pattern | Base XP |
|---|---|
| Exact: `TO DO - TODAY !` | 30 |
| Matches `/JOB SEARCH/i` (any lane containing this) | 25 |
| `DEV - VENERA 🔺` or `DEV - CODAIC` | 20 |
| `DEV - PERSONAL` | 15 |
| `TO DO - BACKBURNER` | 5 |
| `DONE - REVIEW`, `Archive` | hidden (excluded from dashboard entirely) |
| Any other lane | 10 (fallback) |

### 2.3 Modifiers (added to base XP)

Applied AFTER base XP is computed (auto only — not hashtag overrides):

| Trigger | XP modifier |
|---|---|
| Title contains 🔥 | +10 |
| Title contains ⭐ | +5 |
| Title contains 🔺 | +10 |
| Title contains `URGENT` or `TODAY` (case-insensitive) | +5 |

Multiple modifiers stack. Example: `🔥 ⭐ URGENT — Apply to Vercel` in the JOB SEARCH lane = 25 (base) + 10 (🔥) + 5 (⭐) + 5 (URGENT) = **45 XP**.

### 2.4 Subtask Scoring

Subtasks do NOT have their own XP value. XP is awarded only when the parent's top-level checkbox transitions to complete. Subtask completion contributes to the parent's `objectiveProgress` (visual progress bar inside the quest card and modal) but does not fire an XP event.

### 2.5 Flag Derivation

The `flags` array is populated independently of XP scoring:
- 🔥 → adds `"urgent"`
- ⭐ → adds `"starred"`
- 🔺 → adds `"critical"`

Flags drive visual presentation (small icon row on quest cards).

## 3. Category Mapping (v1 defaults)

Applied in order; first match wins.

| Rule | Maps to |
|---|---|
| Exact: `TO DO - TODAY !` | **Daily Quests** (featured at top of dashboard) |
| Matches `/JOB SEARCH/i` | **Job Hunt** (merges 8 lanes into one) |
| Matches `/^DEV - (.+)/` | uses the captured suffix as the category name (`DEV - VENERA 🔺` → **Venera**, `DEV - CODAIC` → **Codaic**, `DEV - PERSONAL` → **Personal Dev**) |
| Exact: `TO DO - BACKBURNER` | **Side Quests** (rendered dimmed) |
| Exact: `DONE - REVIEW`, `Archive` | hidden |
| Fallback | use raw lane name as-is |

Rules live in `config/categoryMap.json` and can be overridden without code changes.

## 4. Sorting Within Categories

Quests within each category are sorted by:

1. **XP descending** (highest priority first)
2. **Flag tiebreaker**: among same XP, `critical` > `urgent` > `starred` > none
3. **Alphabetical** title fallback

Completed quests are sorted to the bottom of their category when "Show Completed" is ON.

## 5. Progress Bar Math

### 5.1 Numerator
Sum of XP from all quests in `xp-history.jsonl` whose timestamp falls within the window:
- **Daily**: today, local time (midnight to midnight)
- **Weekly**: Monday 00:00 to Sunday 23:59, local time

### 5.2 Denominator (the bar's "max")
- **Days 0-6** of dashboard use: fixed values from `config/targets.json`
  - Default: `{ daily: 50, weekly: 250 }`
- **Day 7+**: rolling 7-day average of daily/weekly XP totals
  - The fixed goal still renders as a faint marker line on the bar ("ambition vs. average")

### 5.3 Streak
Consecutive days (ending today) where `daily XP > 0`. Reset by any zero-XP day.

## 6. XP History Storage

### 6.1 File Format
`data/xp-history.jsonl` — append-only JSONL, one event per line:

```json
{"ts":"2026-05-18T14:30:00Z","questId":"obsidian:daily-todo:job-search-this-week:0","xp":35,"source":"obsidian","title":"Apply to 3 Support Adventure competitors"}
```

### 6.2 First-Run Backfill
On the very first server start (detected via absence of `data/.backfilled-<sourceId>` marker), each adapter scans its source for historical completions and emits XP events for each:
- Obsidian: scans for `✅ YYYY-MM-DD` markers; uses that date as `ts` (with time `00:00:00Z`)
- After backfill completes, writes the marker file to prevent repeat backfills

### 6.3 Live Completion Capture
After backfill, the aggregator on each read compares current quest state against the previous snapshot. New completions (transition from `completed: false` to `completed: true`) emit fresh XP events. Deduped by `questId + date` to prevent doubles.

### 6.4 No Retroactive Removals
If a quest is un-completed in the source (e.g., user unchecks a box in Obsidian), the original XP event remains in the log. The rolling avg continues to count it. This is consistent with the append-only log philosophy and acceptable per the "source authoritative on read" policy.

## 7. Subtask Behavior

- **Display**: subtasks appear inside the parent's expanded view (modal) as a read-only checklist
- **Progress bar on card**: filled per `objectiveProgress.done / objectiveProgress.total` (visual only)
- **No XP for subtask completions in v1**
- **No interactivity on subtask checkboxes in v1** — to mark a subtask done, the user opens the source (Obsidian) via the "Open in Obsidian" modal button

## 8. Modal Actions

The quest modal displays two action buttons:

### 8.1 Mark Complete
- Primary button, neon-accent style
- Triggers `POST /api/quests/:id/complete`
- On success: plays XP gain animation in HUD, closes modal, marks quest as completed in UI optimistically
- On 409 Conflict (quest changed in source): shows toast "Quest changed in source — refreshing..." and refreshes data
- On any error: shows toast with error, keeps modal open

### 8.2 Open in Obsidian
- Secondary button
- Opens `quest.deepLink` in a new browser tab (browser launches the `obsidian://` URI)
- Closes modal after opening

## 9. Show/Hide Completed Toggle

- Located in header HUD, top-right
- Default state: **OFF** (only active quests visible)
- When ON:
  - Completed quests render alongside active ones, sorted to bottom of each category
  - Completed quests use the dimmed/strikethrough variant (`CompletedQuestCard`)
  - Empty categories that had only hidden completed quests become visible
- State persisted in `localStorage` (so it survives reloads)

## 10. HTTP API (v1)

All endpoints return JSON. CORS is open for `localhost` only.

### 10.1 `GET /api/quests`

Returns the full quest list plus sync metadata.

**Response**:
```json
{
  "quests": [ Quest, ... ],
  "categories": ["Daily Quests", "Job Hunt", "Personal Dev", ...],
  "meta": {
    "lastSyncAt": "2026-05-18T14:30:00Z",
    "sources": [
      { "id": "obsidian", "status": "ok", "lastReadAt": "...", "questCount": 153 }
    ]
  }
}
```

### 10.2 `GET /api/history`

Returns XP history for progress bar + streak computation.

**Response**:
```json
{
  "today": { "xp": 72, "events": [...] },
  "week": { "xp": 180, "events": [...] },
  "rollingAvg7Day": { "daily": 65, "weekly": 420 },
  "streak": 4,
  "totalDays": 23
}
```

### 10.3 `POST /api/quests/:id/complete`

Marks a quest as complete. Writes back to source.

**Request body**: empty
**Response (200)**:
```json
{ "success": true, "quest": Quest, "xpAwarded": 35 }
```
**Response (409 Conflict)**:
```json
{ "error": "quest_changed", "message": "Quest title changed in source. Please refresh." }
```
**Response (404)**:
```json
{ "error": "not_found" }
```

### 10.4 `GET /api/health`

Per-source health check.

**Response**:
```json
{
  "status": "ok",
  "sources": [
    { "id": "obsidian", "status": "ok", "lastSuccess": "2026-05-18T14:30:00Z", "lastError": null }
  ]
}
```

## 11. Configuration Files

All under `config/`. Editable by hand. Server reads on startup; restart required for changes (v1).

### 11.1 `config/sources.json`
```json
{
  "sources": [
    {
      "id": "obsidian",
      "adapter": "ObsidianAdapter",
      "config": {
        "file": "/home/andre/Documents/ObsMain/_TASKS & REMINDERS/& DAILY TO DO.md",
        "vault": "ObsMain"
      },
      "pollIntervalSec": 60
    }
  ]
}
```

### 11.2 `config/targets.json`
```json
{
  "daily": 50,
  "weekly": 250
}
```

### 11.3 `config/categoryMap.json`
Overrides default category mapping rules. Optional — defaults baked into code.
```json
{
  "rules": [
    { "match": { "lane": "TO DO - TODAY !" }, "category": "Daily Quests", "featured": true }
  ]
}
```

## 12. Edge Case Matrix

| Scenario | Behavior |
|---|---|
| Quest completed in source after dashboard loaded | Next read shows as completed; if user clicks "Mark Complete" on stale view, server returns 200 no-op |
| Quest unticked in source after being completed via dashboard | Source authoritative; dashboard shows as active; XP history entry preserved (counts toward totals) |
| Source file deleted/renamed | Adapter returns empty list + error meta; dashboard shows persistent HUD warning banner; cached quest list still rendered |
| Title edited in source | Same ID (position-stable); quest updates seamlessly |
| Task reordered within a lane | ID changes → treated as new quest; old XP history orphans (still counts) |
| Backend unreachable | Frontend shows cached data + error banner; "Mark Complete" disabled |
| Concurrent writes (rare) | Advisory `.lock` file; second write waits up to 5s then 409 |
| Quest with `#xp25` tag in title | Override applied; tag stripped from title display; `xpSource: "tag"` flagged in UI |
| Modifier emoji in subtask but not parent | Subtask flags computed independently but irrelevant — XP only fires on parent |
| User adds new quest in source between polls | Picked up on next poll (within 60s) or manual refresh |

## 13. Data Validation

- Quest titles MUST be non-empty after tag stripping; empty titles are skipped with a warning log
- XP MUST be a non-negative integer; clamp at 0 if rules produce negative
- IDs MUST be unique within a single `/api/quests` response; collisions logged as errors
- Completion timestamps MUST be valid ISO 8601; invalid → treated as null

## 14. v2/v3 Spec Stubs (deferred)

These are NOT v1 requirements but are listed here so the architecture can accommodate them.

### v2 — GoogleTasksAdapter
- Reads via `tasks.tasks.list` from Google Tasks API
- Writes completion via `tasks.tasks.patch` setting `status: "completed"`
- OAuth via user's own Google Cloud OAuth client (Desktop App type)
- Each Google task list becomes a separate `rawLane`; category mapping rules can group them

### v3 — GoogleCalendarAdapter
- Reads upcoming events via `events.list` from Google Calendar API
- Events become "timeboxed quests" with `startTime` and `endTime` fields added to `Quest`
- Marked "complete" by either: passing the end time, or user explicitly marking complete in dashboard (no write-back to source — calendar events don't have a "completed" state)
- Renders in a distinct HUD timeline component, separate from regular quest cards
