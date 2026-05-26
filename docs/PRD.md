# Quest Dashboard — Product Requirements Document

**Version**: 1.0 (v1 MVP scope)
**Date**: 2026-05-18
**Status**: Approved (brainstorm complete, pending implementation plan)
**Owner**: maintainer

---

## 1. Problem Statement

A user's tasks live in multiple places:
- An Obsidian kanban board (`& DAILY TO DO.md`) — the primary planning surface, ~14 lanes, ~150 active tasks at any time
- Google Tasks — used for quick capture from a phone home-screen widget
- Google Calendar — events that compete for the same time/attention as tasks

There is no single view that shows everything in one place. The Obsidian kanban is rich but visually flat and gets overwhelming. Google Tasks are easy to add but hard to prioritize against Obsidian items. Calendar events are invisible to the task planning surface.

The lack of a unified, motivating dashboard contributes to:
- Time lost alt-tabbing between sources
- Low-priority backlog items overshadowing the few things that actually matter today
- No sense of momentum or progress — completing a task feels identical to ignoring one
- Two separate planning loops (Obsidian for big stuff, GTasks for quick stuff) that never reconcile

## 2. Vision

A single browser-based "Quest Dashboard" that:
- Pulls tasks from all relevant sources into one cyberpunk-HUD-styled view
- Frames each task as an RPG **quest** with category, XP value, and (where applicable) objectives
- Shows daily and weekly XP progress bars at the top, providing the gamified motivation loop
- Supports **bidirectional sync**: actions taken in the dashboard (e.g., marking a quest complete) write back to the original source

## 3. Target User

A single user (the maintainer or anyone forking this project). This is a personal productivity tool, not a multi-user product. Design decisions optimize for one person's workflow and existing data structures (specifically, the existing Obsidian kanban format).

## 4. Goals

1. **Unify** task views from multiple sources into one dashboard
2. **Motivate** through gamification: XP, progress bars, RPG framing
3. **Reduce friction**: bidirectional sync means no double-bookkeeping
4. **Stay current**: dashboard reflects source state on every visit, with no manual export/import step
5. **Be extensible**: architecture must accept new sources (Google Tasks, Calendar, future) without core rewrites

## 5. Non-Goals

- **Not** a replacement for Obsidian, Google Tasks, or Google Calendar — the dashboard is a view + sync layer, not a new source of truth
- **Not** a multi-user system — no auth beyond OAuth for personal Google accounts
- **Not** a mobile-first app — desktop browser is the primary surface (mobile-friendly is a v4 nice-to-have)
- **Not** a public/shareable artifact — runs locally on the user's machine

## 6. Success Criteria

The MVP is successful when the user:
1. Opens the dashboard at least once daily as part of his morning routine
2. Uses the dashboard's "Mark Complete" action instead of editing the kanban directly (at least 50% of the time)
3. Reports the daily XP progress bar as motivating rather than stressful
4. Trusts the dashboard's view of his tasks (no need to cross-check against Obsidian)

## 7. Feature Requirements (high-level)

Detailed behavior lives in [SPEC.md](SPEC.md). High-level capabilities for v1:

| Capability | Description |
|---|---|
| Source: Obsidian kanban | Read all top-level tasks + nested subtasks from `& DAILY TO DO.md` |
| Category mapping | Group similar lanes (e.g., merge all JOB SEARCH lanes into one "Job Hunt" category) |
| XP scoring | Auto-derive points per task from lane + emoji markers; `#xpN` hashtag overrides auto rules |
| Progress HUD | Daily + weekly XP progress bars at top of page |
| Quest cards | One card per top-level task, with title, XP badge, flags, subtask progress |
| Quest modal | Click card → modal with "Mark Complete" and "Open in Obsidian" actions |
| Bidirectional sync | "Mark Complete" writes `- [x] ✅ YYYY-MM-DD` back to kanban |
| Show/hide completed | Toggle in header; default hidden |
| Rolling average baseline | After 7 days of history, progress bars compare against your rolling 7-day average |
| Cyberpunk HUD aesthetic | Neon accents, monospace fonts, scan-line animations, completion glitch effects |

## 8. Out of Scope (v1)

- Google Tasks integration (planned for v2)
- Google Calendar integration (planned for v3)
- Live file watching (planned for v2 — v1 uses 60s polling)
- Inline subtask completion (subtasks read-only in v1)
- Achievements / badges / streaks beyond a simple day-streak counter
- Mobile responsive layout
- Multi-vault Obsidian support
- Exporting summaries or reports

## 9. Constraints

- **Stack preference**: JavaScript / TypeScript ecosystem (Node + React) — leverages the maintainer's existing skills
- **Runtime**: Local-only. No cloud hosting. Local server + browser frontend.
- **Source format**: Obsidian kanban plugin format must be preserved exactly when writing back (the plugin reads what we write)
- **Authentication**: None for v1 (single-user, localhost-only). Future Google sources will use the user's own OAuth client.
- **Storage**: Flat files only (JSON, JSONL). No database in v1.

## 10. Roadmap

### v1 — MVP (Obsidian-only)
End-to-end working dashboard with single source. See feature table in §7 and full detail in [SPEC.md](SPEC.md).

### v2 — Google Tasks
- `GoogleTasksAdapter`: read + write via Google Tasks REST API using user's own OAuth client
- Live Obsidian file watching: websockets replace polling for instant updates
- GTasks history backfill into XP log

### v3 — Google Calendar
- `GoogleCalendarAdapter`: events as timeboxed quests with distinct HUD timeline visual
- Combined view: events + tasks across all sources, sorted by time-relevance
- Optional conflict UI (upgrade from last-write-wins if needed)

### v4+ — Polish & Extras (parking lot, not committed)
- Achievement badges (streaks, category mastery)
- Trends/heatmap stats page
- Weekly export
- PWA install + mobile responsive
- Additional source adapters (Notion, Linear, etc.)

## 11. Risks & Open Questions

| Risk | Mitigation |
|---|---|
| Writing back to the kanban corrupts the file | Defensive verification before write; advisory file lock; preserved indentation; manual `.bak` of the file on first run |
| Position-based IDs break on reorder | Acceptable trade-off for personal tool; reordering is rare; orphaned XP history still counts toward totals |
| 60s polling feels stale when working actively in Obsidian | Manual refresh button + planned v2 file watching |
| Auto XP scoring doesn't match user's intuition | `#xpN` hashtag override available from v1 |
| Conflict between dashboard edit and source edit | Source is authoritative on every read; user accepts this means dashboard clicks can be overridden |

## 12. Related Documents

- [SPEC.md](SPEC.md) — precise feature behavior, data schemas, API
- [ARCHITECTURE.md](ARCHITECTURE.md) — technical design, adapter pattern, data flow
- [USER-STORIES.md](USER-STORIES.md) — concrete acceptance criteria grouped by epic
