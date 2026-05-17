# Quest Dashboard — User Stories

**Version**: 1.0 (v1 MVP)
**Date**: 2026-05-18
**Companion docs**: [PRD.md](PRD.md), [SPEC.md](SPEC.md), [ARCHITECTURE.md](ARCHITECTURE.md)

Stories are grouped by epic. Each story has acceptance criteria. Stories marked **[v1]** are required for MVP; **[v2]** and **[v3]** are deferred.

---

## Epic A — Daily Quest Loop

### A1. See today's quests at a glance [v1]
**As** Andre,
**I want** my "TO DO - TODAY" tasks featured at the top of the dashboard
**so that** I see what matters today without scrolling.

**Acceptance criteria**:
- The "Daily Quests" section is the first section rendered after the header HUD
- Section uses visually distinct styling (brighter accent, larger cards) vs. other categories
- Only tasks from the source's `TO DO - TODAY !` lane appear here
- If the today lane is empty, the section renders an empty state: "No quests for today — set your objectives in Obsidian"

### A2. Complete a quest and earn XP [v1]
**As** Andre,
**I want** to click "Mark Complete" on a quest card and see my XP increase
**so that** I get an immediate sense of progress.

**Acceptance criteria**:
- Clicking a quest card opens the modal
- Modal shows a primary "Mark Complete" button
- On click: HUD daily/weekly bars animate to new values; XP gain number briefly displays; modal closes
- The completion is written back to the source within 1 second
- Quest disappears from the active view (or shows dimmed if "Show Completed" is ON)

### A3. Build a daily/weekly progress streak [v1]
**As** Andre,
**I want** the dashboard to track consecutive days I've earned XP
**so that** I feel motivated to maintain momentum.

**Acceptance criteria**:
- Streak counter displayed in HUD: "Streak: N days"
- Streak increments when today's XP > 0 AND yesterday's XP > 0 (or it's the first day)
- Streak resets to 1 on the first day with XP after a zero-XP day
- Streak persists across server restarts (computed from `xp-history.jsonl`)

---

## Epic B — Multi-Lane Visibility

### B1. See all categories in one view [v1]
**As** Andre,
**I want** my dashboard organized into clear category sections
**so that** I can scan across all my work without opening Obsidian.

**Acceptance criteria**:
- Categories appear in fixed order: Daily Quests → Job Hunt → Personal Dev → Codaic → Venera → Side Quests
- Each section has a header showing the category name and active quest count
- Empty categories (after filtering) are hidden, except Daily Quests (always shown)

### B2. Job search lanes merged into one category [v1]
**As** Andre,
**I want** all 8 JOB SEARCH lanes consolidated into one "Job Hunt" category
**so that** my dashboard isn't dominated by 8 nearly-duplicate sections.

**Acceptance criteria**:
- All quests from any lane matching `/JOB SEARCH/i` appear under "Job Hunt"
- The original lane is preserved as `rawLane` metadata (for traceability / debugging)
- Within "Job Hunt", quests are sorted per spec rules (XP desc, flag tiebreaker, alpha)

### B3. Hide done/archive lanes [v1]
**As** Andre,
**I want** the "DONE - REVIEW" and "Archive" lanes excluded from my dashboard
**so that** I see only active quests, not historical clutter.

**Acceptance criteria**:
- Quests in these lanes never appear, regardless of "Show Completed" toggle state
- They do not contribute to XP totals or progress bars
- They are still counted by the backfill process (so historical XP is preserved)

### B4. See backlog as low-emphasis "Side Quests" [v1]
**As** Andre,
**I want** "TO DO - BACKBURNER" quests rendered in a dimmer section at the bottom
**so that** they're visible but don't distract from active work.

**Acceptance criteria**:
- Section labeled "Side Quests"
- Rendered at 50-70% opacity
- Sorted to the bottom of the dashboard, always last

---

## Epic C — Bidirectional Sync

### C1. Completions write back to source [v1]
**As** Andre,
**I want** "Mark Complete" in the dashboard to update the original task in Obsidian
**so that** I don't have to update two places.

**Acceptance criteria**:
- After clicking Mark Complete, the kanban file is updated within 1 second
- The update changes `- [ ] X` to `- [x] X ✅ YYYY-MM-DD` (today's date)
- The file's formatting (indentation, surrounding lines) is preserved exactly
- If Obsidian has the file open, the change is picked up automatically (no manual reload required)

### C2. Source changes appear in dashboard [v1]
**As** Andre,
**I want** changes I make in Obsidian to appear in the dashboard within a minute
**so that** the dashboard always reflects current reality.

**Acceptance criteria**:
- Background poll runs every 60 seconds
- Newly added quests appear within 60s
- Quests completed in Obsidian appear as completed within 60s (and XP is awarded)
- Edited titles update without losing position or breaking IDs
- Manual refresh button in HUD forces an immediate fetch

### C3. Open quest in Obsidian directly [v1]
**As** Andre,
**I want** to click "Open in Obsidian" from the modal and jump to the task
**so that** I can edit details, add subtasks, or restructure without searching.

**Acceptance criteria**:
- Modal has secondary button "Open in Obsidian ↗"
- Click opens `obsidian://` URI in new browser tab
- Obsidian opens to the correct file (vault: ObsMain)
- (Best-effort) scrolls to or highlights the specific line — acceptable if v1 just opens the file

### C4. Conflict on stale view [v1]
**As** Andre,
**I want** the dashboard to detect when a quest has changed in the source between my view and my action
**so that** I don't accidentally overwrite a recent edit.

**Acceptance criteria**:
- If a quest's title has changed since the dashboard's last read, "Mark Complete" returns 409
- Frontend shows a toast: "Quest changed in source — refreshing..."
- Dashboard automatically refetches and updates
- User can then re-click Mark Complete on the updated quest

---

## Epic D — XP & Scoring

### D1. Auto-scored XP per quest [v1]
**As** Andre,
**I want** every quest automatically scored based on its lane and emoji markers
**so that** I don't have to manually assign points to each task.

**Acceptance criteria**:
- Quest cards show an XP badge in the top-right corner
- Values follow the rules in [SPEC.md §2](SPEC.md#2-xp-scoring-rules-v1)
- An "auto" indicator (subtle, perhaps just the absence of the "tag" style) distinguishes auto-scored quests

### D2. Override XP with a hashtag [v1]
**As** Andre,
**I want** to override a quest's XP by adding `#xp25` to its title in Obsidian
**so that** I can boost or downgrade specific tasks beyond what auto-rules give.

**Acceptance criteria**:
- Tags matching `#xp(\d+)` are detected (any position in the title)
- The matched number becomes the quest's XP value
- The tag is stripped from the displayed title
- The XP badge visually indicates it's a manual override (different style, e.g., subtle underline)
- Auto modifiers (🔥, ⭐, etc.) do NOT apply to tag-overridden values

### D3. Modifiers stack additively [v1]
**As** Andre,
**I want** emoji markers like 🔥 ⭐ to add to a quest's base XP
**so that** I can signal extra importance with the markers I already use.

**Acceptance criteria**:
- Stacking works per [SPEC.md §2.3](SPEC.md#23-modifiers-added-to-base-xp)
- The card's XP badge shows the final computed value (not the base)
- Hovering the XP badge could optionally show a breakdown ("25 base + 10 🔥 + 5 ⭐ = 40") — v1 nice-to-have

---

## Epic E — Subtasks (Objectives)

### E1. See subtask progress on the quest card [v1]
**As** Andre,
**I want** each quest card to show how many subtasks are done
**so that** I see partial progress without opening the modal.

**Acceptance criteria**:
- Cards with subtasks show a thin progress bar at the bottom: "Objectives: 2/6"
- Bar fills proportionally
- Cards without subtasks omit this element entirely

### E2. Inspect subtasks via modal [v1]
**As** Andre,
**I want** the modal to show me the full subtask checklist (read-only)
**so that** I know exactly what's left in a quest before deciding to mark it complete.

**Acceptance criteria**:
- Modal body lists all subtasks with their checked/unchecked state visible
- Subtasks are NOT interactive in v1 (clicking does nothing)
- Nested sub-subtasks (3+ levels deep) render with indentation

### E3. XP only awarded on parent completion [v1]
**As** Andre,
**I want** XP to fire only when the parent quest is marked complete
**so that** I don't double-count progress.

**Acceptance criteria**:
- Subtask completions in the source do NOT generate XP events
- Marking the parent complete generates one XP event with the parent's full XP value
- The parent's own subtasks are NOT auto-completed in the source (parent's checkbox is the only one that's toggled)

---

## Epic F — Progress HUD

### F1. Daily and weekly progress bars [v1]
**As** Andre,
**I want** large progress bars at the top of the dashboard showing my XP for today and this week
**so that** I get the gamified motivation hit every time I open the page.

**Acceptance criteria**:
- HUD shows two bars: DAILY and WEEKLY
- Each bar shows current XP / target (e.g., "72/100 XP")
- Bars animate smoothly when values change (XP gain after completion)
- Bars use neon-accent cyberpunk fill style
- Weekly bar resets every Monday 00:00 local time

### F2. Fixed goal as starting baseline [v1]
**As** Andre (in my first week using the dashboard),
**I want** progress bars to use my pre-set XP goals as targets
**so that** the bars feel meaningful before I have history.

**Acceptance criteria**:
- Targets read from `config/targets.json` (defaults 50/250)
- User can edit this file directly; restart applies new values
- Bars fill toward these values for the first 7 days of usage

### F3. Rolling average baseline after 7 days [v1]
**As** Andre (after one week of usage),
**I want** progress bars to switch to my rolling 7-day average
**so that** I'm competing with my recent self instead of an arbitrary number.

**Acceptance criteria**:
- After 7+ days of history exists in `xp-history.jsonl`, denominator switches to rolling average
- The originally configured fixed goal still appears as a faint marker line on the bar
- A label/legend indicates which mode is active (e.g., "↑ avg 65" suffix)

---

## Epic G — Completed Quests

### G1. Hide completed quests by default [v1]
**As** Andre,
**I want** completed quests hidden from the active dashboard view
**so that** my dashboard stays focused on what's left to do.

**Acceptance criteria**:
- "Show Completed" toggle in header HUD; default OFF
- When OFF: no completed quests render; categories with only completed quests are hidden
- Toggle state persists in localStorage

### G2. Toggle to celebrate completed quests [v1]
**As** Andre,
**I want** to optionally show completed quests as dimmed/struck-through cards
**so that** I can review my recent wins for satisfaction.

**Acceptance criteria**:
- Toggle ON: completed quests render alongside active ones, sorted to bottom of each category
- Completed cards use the `CompletedQuestCard` variant (dimmed, strikethrough title, green ✓)
- Completion date is shown on the card
- Toggling doesn't trigger a refetch — uses already-loaded data

---

## Epic H — Cyberpunk HUD Aesthetic

### H1. Quest dashboard feels like a sci-fi UI [v1]
**As** Andre,
**I want** the dashboard to look like a cyberpunk HUD
**so that** opening it feels exciting and reinforces the RPG framing.

**Acceptance criteria**:
- Dark background with neon accent colors (precise palette TBD in implementation)
- Monospace or HUD-style display fonts
- Subtle scan-line effect on quest cards on hover
- Glitch animation plays briefly when XP is awarded
- HUD chrome (borders, badges, bars) uses sharp/angular shapes (no fully rounded "soft" cards)

### H2. Loading and error states match the aesthetic [v1]
**As** Andre,
**I want** loading and error states to feel consistent with the cyberpunk vibe
**so that** the experience doesn't break character.

**Acceptance criteria**:
- Loading: "INITIALIZING…" with animated cursor/ellipsis
- Source sync error: HUD warning banner ("⚠ SYNC FAILURE — using cached data")
- All-quests-done state: "ALL QUESTS COMPLETE — STANDBY FOR NEW OBJECTIVES"
- Network/backend error: persistent banner with "RETRY" button

---

## Epic I — Source Extensibility (Future)

### I1. Add Google Tasks as a source [v2]
**As** Andre,
**I want** my Google Tasks to appear in the dashboard alongside Obsidian quests
**so that** quick captures from my phone widget aren't isolated.

**Acceptance criteria**:
- New `GoogleTasksAdapter` registered in `sources.json`
- Google Tasks appear with their own category mapping (e.g., each list = one category, or merged via custom rule)
- Marking complete in dashboard updates the Google Tasks API
- No changes to scoring, frontend, or aggregator required

### I2. Live updates from source changes [v2]
**As** Andre,
**I want** changes in Obsidian to appear in the dashboard immediately (not after a 60s poll)
**so that** the dashboard feels truly live.

**Acceptance criteria**:
- Backend uses chokidar to watch source files
- WebSocket connection pushes "data-changed" events to frontend
- Frontend refetches on receipt
- 60s polling remains as fallback if WebSocket disconnects

### I3. Calendar events as timeboxed quests [v3]
**As** Andre,
**I want** Google Calendar events visible as timeboxed quests
**so that** my calendar competes for attention alongside my task list.

**Acceptance criteria**:
- Calendar events render in a distinct timeline component (not as regular quest cards)
- Each event shows start time, duration, and is marked "in progress" or "upcoming"
- Past events appear as completed (no manual marking needed)
- Calendar quests do NOT have write-back (events have no "completed" state to mark)

---

## Story Sizing Reference

The stories above are intended as acceptance criteria, not as estimates. Detailed implementation planning happens in the `writing-plans` skill output (see `IMPLEMENTATION-PLAN.md` in this folder once generated).
