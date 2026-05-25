# Quest Dashboard — v1.1 Spec: Interactive Subtasks

**Version**: 1.1 (delta-spec on top of v1)
**Date**: 2026-05-25
**Status**: Approved, ready for implementation plan
**Parent docs**: [PRD.md](PRD.md), [SPEC.md](SPEC.md), [ARCHITECTURE.md](ARCHITECTURE.md), [USER-STORIES.md](USER-STORIES.md)

This document amends the v1 spec to make subtasks interactive in the QuestModal. Anything not mentioned here is unchanged from v1.

---

## 1. Motivation

In v1, subtasks are read-only ([SPEC.md §2.4](SPEC.md#24-subtask-scoring), [§7](SPEC.md#7-subtask-behavior), [§8.1](SPEC.md#81-mark-complete)) — you can only mark progress by editing in Obsidian, then waiting for the dashboard to poll. This breaks the "stay in the dashboard" loop the design was supposed to enable. v1.1 makes subtasks clickable and ties parent quest completion to them.

## 2. Behavior

### 2.1 Subtask click semantics
- An unchecked subtask in the modal is clickable.
- Clicking writes `- [x] <title>` to the subtask's line in the kanban (preserving indentation; no `✅ <date>` stamp — that's reserved for top-level quests).
- No XP is awarded for individual subtask completions.
- The modal's `<ObjectivesBar>` reflects the new done/total immediately (optimistic update) and the count animates.
- Already-completed subtasks render struck-through and non-clickable.
- Un-completing subtasks via the dashboard is NOT supported in v1.1. Use Obsidian for that.

### 2.2 Parent auto-completion (transitive)
- When the LAST incomplete subtask of a quest gets ticked, the parent quest is automatically completed in the same request:
  - Parent line is rewritten to `- [x] <title> ✅ <today>` (matches the existing parent-completion format).
  - Exactly one XP event for the parent is appended to `xp-history.jsonl`.
  - The modal closes and the existing parent-completion toast + HUD bar animation fires.
- This auto-completion happens server-side, atomically inside the same `markComplete` adapter call. No client-side race conditions possible.

### 2.3 Parent "Mark Complete" button
- For a quest with NO subtasks: button behavior unchanged from v1.
- For a quest WITH subtasks:
  - If any subtask is incomplete → button is **disabled** with helper text underneath: `Complete all objectives first ({done}/{total})`.
  - If all subtasks are complete → in practice this state is unreachable from the dashboard, because ticking the last subtask already auto-completed the parent. The button is theoretically enabled in this branch but won't be hit. If the modal is somehow still open with this state (e.g., user opened a quest where they completed subtasks externally in Obsidian and then opened the modal), clicking it completes the parent as in v1.

### 2.4 Modal ObjectivesBar
- The same `<ObjectivesBar>` component used on `QuestCard` is rendered inside the modal, just above the subtask checklist, inside the existing "Objectives" block.
- It reads `done/total` from the modal's local state (which mutates optimistically), not from the server snapshot, so the bar fills immediately on click.
- After the next refetch, server state is authoritative.

## 3. API Changes

### 3.1 `POST /api/quests/:id/complete` extensions

The endpoint now accepts subtask IDs as well as top-level quest IDs.

**Resolution rule**: search top-level quests first; if no match, recurse into each quest's `objectives[]` (one level deep — subtasks don't have their own subtasks in v1.1).

**New 422 response** — parent with incomplete subtasks:

```json
{ "error": "subtasks_incomplete", "remaining": 3 }
```

Returned when the resolved quest is a top-level quest, has objectives, and at least one objective is incomplete.

**Successful subtask response** — no parent transition:

```json
{
  "success": true,
  "subtask": { ...subtask quest object... },
  "xpAwarded": 0,
  "parentCompleted": false
}
```

**Successful subtask response** — parent auto-completed transitively:

```json
{
  "success": true,
  "subtask": { ...subtask quest object... },
  "xpAwarded": <parent's XP>,
  "parentCompleted": true,
  "parent": { ...parent quest object, with completed: true... }
}
```

**Existing parent-completion responses** unchanged (200 success, 404 not_found, 409 quest_changed).

### 3.2 Quest schema additions

The canonical `Quest` schema gets one optional field added to subtask quests' `sourceRef`:

```ts
sourceRef: {
  file: string;
  line: number;
  parentLine: number | null;   // null for top-level; line of parent for subtasks
  expectedTitle: string;       // NEW for subtasks — was already present for top-level
}
```

In v1 the field was set on top-level quests but missing on subtasks. v1.1 sets it on both. This is needed so the adapter can verify the subtask line still matches before writing (same conflict-detection mechanism the parent already uses).

## 4. Adapter Changes

### 4.1 `ObsidianAdapter._buildQuest`

When building objective quests, populate `sourceRef.expectedTitle` with `obj.title`. Previously this field was omitted.

### 4.2 `ObsidianAdapter.markComplete`

Behavior bifurcates based on `sourceRef.parentLine`:

- **parentLine === null** (top-level quest): unchanged from v1.
- **parentLine !== null** (subtask):
  1. Acquire lock on file.
  2. Re-read file, verify line content matches `expectedTitle`, throw `ConflictError` if not.
  3. Rewrite subtask line as `- [x] <title>` (no date stamp, preserve indent).
  4. Walk subsequent lines starting at `parentLine + 1` and gather all sibling subtasks (lines that start with `\t- [` after the parent line, stopping at the next non-indented line).
  5. If all siblings (including the one just written) are now `- [x]`, also rewrite the parent line as `- [x] <parent title> ✅ <today>`.
  6. Release lock.
  7. Return `{ subtaskCompleted: true, parentCompleted: <bool>, parentSourceRef: <parent's sourceRef or null> }`.

The route handler is responsible for emitting the XP-history event when `parentCompleted: true`.

## 5. Frontend Changes

### 5.1 `QuestModal.jsx`

- Maintain local state `objectives` initialized from `quest.objectives` so we can update optimistically.
- Render `<ObjectivesBar done={liveDone} total={liveTotal} />` just above the subtask `<ul>`. The bar uses values computed from the local `objectives` array, NOT `quest.objectiveProgress`.
- For each subtask:
  - Unchecked + not currently writing: render as a `<button>` with onClick triggering `handleObjectiveClick(subtask)`.
  - Checked: render as static struck-through text (current style preserved).
- `handleObjectiveClick(subtask)`:
  1. Optimistically mark the subtask as completed in local state.
  2. Call `postComplete(subtask.id)`.
  3. On success:
     - If `parentCompleted` → close modal, call parent's `onComplete` handler with the parent quest so the existing XP toast + HUD bar fires.
     - If only subtask completed → show a small "Objective complete" toast (smaller variant than the parent XP toast). Modal stays open.
  4. On 422 (`subtasks_incomplete`) → can't happen via subtask click, but log and surface generic error toast.
  5. On 409 (`CONFLICT`) → existing conflict toast pattern; close modal, refetch.
  6. On other error → roll back the optimistic update + show error toast.
- Mark Complete button (parent):
  - `disabled` prop: `liveTotal > 0 && liveDone < liveTotal`.
  - When disabled, show helper text below: `Complete all objectives first ({liveDone}/{liveTotal})`.

### 5.2 `App.jsx`

`handleComplete` extended to handle the new response shape. When the response indicates `parentCompleted: true`, it should behave exactly like a direct parent completion (close modal, fire XP toast with the parent's XP, refetch).

When a subtask completed without parent transition, no XP toast (small "Objective complete" toast via the modal's local handler is enough). Refetch on the next polling tick or via the modal-initiated refetch.

### 5.3 `lib/api.js`

`postComplete(questId)` extended to handle the new 422 response:

```js
if (res.status === 422) {
  const body = await res.json();
  const err = new Error('subtasks_incomplete');
  err.code = 'SUBTASKS_INCOMPLETE';
  err.remaining = body.remaining;
  throw err;
}
```

Existing 409 handling preserved.

## 6. Conflict + Error Handling

| Scenario | Behavior |
|---|---|
| Subtask line title changed in source between modal load and click | Adapter throws ConflictError → route returns 409 → modal shows "Quest changed in source — refreshing…" toast, closes, dashboard refetches. |
| Subtask file deleted between modal load and click | Adapter throws → route 500 → modal shows generic error toast. (File-missing case is rare; covered by the SyncIndicator banner.) |
| User opens modal, ticks subtask 1, then someone ticks subtask 2 in Obsidian → all done state reached externally | Next polling tick (≤60s) shows parent as completed. The modal won't know until refetch. Acceptable for v1.1 — same model as v1's "source authoritative." |
| Subtask line indentation uses spaces instead of tabs | Parser already handles arbitrary `\s+` for indentation. Write-back preserves whatever indentation the original line used. |

## 7. Tests

### 7.1 Backend (server/tests/)

| File | New test |
|---|---|
| `ObsidianAdapter.test.js` | subtask `sourceRef` carries `expectedTitle` |
| `ObsidianAdapter.test.js` | `markComplete` on a subtask line writes `- [x] <title>` without date stamp |
| `ObsidianAdapter.test.js` | `markComplete` on LAST incomplete subtask also writes parent line as `- [x] ... ✅ <today>` |
| `ObsidianAdapter.test.js` | `markComplete` on a non-last subtask leaves parent unchanged |
| `routes.test.js` | POST /complete with a subtask ID resolves via nested lookup and returns 200 |
| `routes.test.js` | POST /complete on a parent with incomplete subtasks returns 422 with `remaining` |
| `routes.test.js` | Completing the last subtask emits exactly ONE parent XP event to history |

### 7.2 Frontend (client/src/tests/)

| File | New test |
|---|---|
| `QuestModal.test.jsx` | renders ObjectivesBar above the subtask list when objectives exist |
| `QuestModal.test.jsx` | clicking an unchecked subtask fires `onObjectiveComplete` (or whatever the prop is named) with that subtask |
| `QuestModal.test.jsx` | bar reflects optimistic done/total after subtask click |
| `QuestModal.test.jsx` | parent "Mark Complete" button is `disabled` when objectives are incomplete |
| `QuestModal.test.jsx` | parent "Mark Complete" button is enabled when no objectives or all complete |
| `api.test.js` | postComplete throws `SUBTASKS_INCOMPLETE` error on 422 response |

## 8. Out of Scope (v1.1)

- Un-ticking subtasks via the dashboard.
- Nested sub-subtasks (3+ levels deep). Already rare; v1 parser flattens them awkwardly.
- "Mark all subtasks complete" parent-cascade button. (Existing user instinct will be to tick them one by one.)
- Visual size variant for ObjectivesBar — reuse current sizing in modal. Bump later if it feels too small.

## 9. Roadmap Position

This is a **v1.1 patch**, not a v2 feature. It ships on the same branch (or a feature-on-feature branch off `feature/v1-implementation` if v1 hasn't merged yet). It does not block or depend on Google Tasks (v2) or Google Calendar (v3).
