# Quest Dashboard — v1.2 Spec: Onboarding Flow

**Version**: 1.2 (delta-spec on top of v1.1)
**Date**: 2026-05-27
**Status**: Approved, ready for implementation plan
**Parent docs**: [PRD.md](PRD.md), [SPEC.md](SPEC.md), [ARCHITECTURE.md](ARCHITECTURE.md), [SPEC-v1.1-subtasks.md](SPEC-v1.1-subtasks.md)

This document amends the v1 + v1.1 spec to introduce a first-run onboarding flow plus a reusable Settings page for managing kanban sources via the UI. Anything not mentioned here is unchanged.

---

## 1. Motivation

In v1 + v1.1, the only way to add or change kanban sources is by hand-editing `config/sources.json` and restarting the server. This is friction for:
- A first-time user who clones the repo and doesn't know the schema
- Any user who maintains multiple kanban files across multiple vaults
- The non-technical Obsidian user the public release is aimed at

v1.2 introduces a guided UI flow for selecting kanban files (either individually or by scanning a vault) plus a Settings page to add/remove sources later. The dashboard no longer requires the config file to exist before first launch.

## 2. UX Flow

### 2.1 State machine

```
MODE_PICK
   ├─→ BROWSE_FILES ───────────→ REVIEW ─→ SAVING ─→ DONE
   └─→ BROWSE_FOLDERS → SCANNING → REVIEW ─→ SAVING ─→ DONE

(any state) → ERROR → (back to previous state)
```

Each state has a `canGoBack` flag. ERROR is non-fatal — the user can always go back and retry.

### 2.2 Entry points

| Condition | Behavior |
|---|---|
| Server reports `setupNeeded: true` (no valid sources configured) | App renders `<OnboardingFlow mode="first-run" />` instead of the dashboard. State starts at MODE_PICK. |
| User clicks the ⚙ Settings button in the header HUD | App renders `<OnboardingFlow mode="settings" />` over the dashboard. State starts at MODE_PICK preceded by an "Existing sources" list (with remove buttons). |

### 2.3 MODE_PICK screen

Two large buttons:
- **"Pick specific file(s)"** → transitions to `BROWSE_FILES`
- **"Scan a vault folder"** → transitions to `BROWSE_FOLDERS`

In settings mode, an "Existing sources" panel appears above the two buttons, showing each currently-configured source with an `X` remove button. Removing a source applies immediately (calls `save-sources` with the reduced list). The two-button picker remains visible below so the user can add additional sources in the same flow.

### 2.4 BROWSE_FILES screen

A custom file-browser UI driven by `GET /api/setup/browse?path=<...>&mode=files`. Layout:

- Breadcrumb header showing the current path (each segment clickable to navigate up).
- A list of entries:
  - Subdirectories first (alphabetical), with a folder icon, clickable to navigate in.
  - `.md` files second (alphabetical). Files where the scanner detected a `kanban-plugin: board` frontmatter marker show a small "kanban" badge and are clickable. Non-kanban `.md` files are **greyed out and unselectable**.
- Multi-select: clicking a kanban file toggles its selection (checkbox-style).
- Footer: "Back" button, selection count ("3 files selected"), "Next →" button (disabled if 0 selected).

The browser starts at the user's home directory. Subsequent navigations remember the last directory visited within the session.

### 2.5 BROWSE_FOLDERS screen

Same component family as 2.4 but driven by `GET /api/setup/browse?path=<...>&mode=folders` — files are filtered out. Each directory entry shows a "(vault)" badge if a `.obsidian/` subfolder is detected inside it. Single-select. Footer: "Back", "Scan →" (disabled if no folder selected).

### 2.6 SCANNING screen

Transient screen while `POST /api/setup/scan-vault` is in flight. Shows the vault path + a HUD-styled "SCANNING…" indicator. No user interaction available. On success → REVIEW. On error → ERROR.

### 2.7 REVIEW screen

A checklist of candidate sources. For BROWSE_FILES path, the candidates are the files the user selected. For BROWSE_FOLDERS path, the candidates are all kanban files detected by the scan. Layout per row:

| Column | Content |
|---|---|
| Checkbox | Pre-checked. Unchecking excludes from save. |
| File path | Relative to home if under `$HOME`, otherwise absolute. |
| Vault name field | Pre-filled by walk-up to nearest `.obsidian/`; editable text input. |

Footer: "Back", "Confirm + Load Dashboard →" (disabled when 0 rows checked).

### 2.8 SAVING screen

Transient — `POST /api/setup/save-sources` in flight. On success → DONE → frontend re-fetches `/api/setup/status` and `/api/quests`, exits onboarding, dashboard renders. On error → ERROR (shows server-reported error per-source; the user can uncheck failing rows and retry).

### 2.9 ERROR screen

Generic error display with the server message. "Back" button returns to the previous state. No data is committed when an error occurs.

## 3. Backend API

All new endpoints under `/api/setup/`. Old endpoints unchanged.

### 3.1 `GET /api/setup/status`

Returns the current configuration state for the frontend to decide what to render.

**Response**:
```json
{
  "setupNeeded": false,
  "sources": [
    { "id": "obsidian", "file": "/path/to/board.md", "vault": "MyVault", "adapter": "ObsidianAdapter" }
  ]
}
```

`setupNeeded` is true when the sources array is empty OR the config file is missing.

### 3.2 `GET /api/setup/browse`

Lists the immediate children of a directory.

**Query**:
- `path` (optional, defaults to `os.homedir()`): the directory to list
- `mode`: `"files"` (subdirectories + `.md` files) or `"folders"` (subdirectories only)

**Response (200)**:
```json
{
  "resolvedPath": "/home/user/Documents",
  "parent": "/home/user",
  "entries": [
    { "name": "Vault", "fullPath": "/home/user/Documents/Vault", "kind": "directory", "hasObsidianMarker": true },
    { "name": "board.md", "fullPath": "/home/user/Documents/board.md", "kind": "file", "isKanban": true }
  ],
  "truncated": false
}
```

`hasObsidianMarker` is only set when `kind: "directory"` AND `mode: "folders"`. `isKanban` is only set when `kind: "file"` AND `mode: "files"`. Entries are returned alphabetically with subdirectories before files. Result capped at **500 entries** — `truncated: true` when capped.

**Errors**: 403 with `{ error: "path_out_of_bounds" }` if path escapes `$HOME`. 400 for invalid `mode` or path that doesn't exist.

### 3.3 `POST /api/setup/scan-vault`

Recursively scans a vault for kanban-plugin board files.

**Body**: `{ "path": "/absolute/path/to/vault" }`

**Response (200)**:
```json
{
  "vaultName": "MyVault",
  "boards": [
    { "relativePath": "Tasks/board.md", "fullPath": "/home/user/Documents/MyVault/Tasks/board.md" }
  ],
  "truncated": false,
  "filesScanned": 247
}
```

`vaultName` is auto-detected: if `<path>/.obsidian/` exists, `vaultName = basename(path)`. Otherwise `vaultName` is `null` and the frontend prompts the user to type one in the REVIEW state.

The walk:
- Skips `.obsidian/`, hidden directories (`.*`), and `node_modules/`
- Reads the first **2 KB** of each `.md` file, looking for `kanban-plugin: board` in the YAML frontmatter
- Has a soft cap of **5,000 files scanned**; sets `truncated: true` if exceeded
- Per-file read errors are logged but do not abort the walk

**Errors**: 403 if path escapes `$HOME`. 400 if path doesn't exist or isn't a directory.

### 3.4 `POST /api/setup/save-sources`

Validates and writes the new sources configuration. Atomically replaces `config/sources.json` and rebuilds the in-process adapter list — no server restart needed.

**Body**:
```json
{
  "sources": [
    { "id": "obsidian", "adapter": "ObsidianAdapter",
      "config": { "file": "/path/to/board.md", "vault": "MyVault" },
      "pollIntervalSec": 60 }
  ]
}
```

**Validation per source**:
- `file` is an absolute path inside `$HOME`
- File exists and is readable + writable
- Parses successfully as a kanban-plugin board (call `parseBoard` from `kanbanMarkdown.js`)
- No duplicate `file` paths across sources

**Response (200)**:
```json
{ "saved": true, "sourceCount": 2, "sources": [...] }
```

**Response (400)** when validation fails (one or more sources rejected):
```json
{
  "saved": false,
  "errors": [
    { "index": 1, "error": "invalid_kanban", "file": "/path/to/x.md", "reason": "no lanes found" }
  ]
}
```

On 400, on-disk config is **untouched**. On 500 (write failure), config is also untouched (atomic write to `.tmp` + rename only on success).

## 4. Server boot resilience

`server/core/configLoader.js` change: missing or empty `config/sources.json` is a valid first-run state, not an error.

**Old behavior**: throws "sources.json is required" → server exits.

**New behavior**:
- If `config/sources.json` is missing: returns `{ sources: { sources: [] }, targets: { ...defaults } }`.
- If `config/sources.json` is present but `sources` array is empty: same as above.
- If `config/sources.json` is malformed JSON: throws (corrupted config is still a real error worth surfacing).

The bootstrap then proceeds with zero adapters. `GET /api/quests` returns `{ quests: [], categories: [], meta: { sources: [], setupNeeded: true, lastSyncAt: <now> } }`.

## 5. Path security

All filesystem-touching endpoints (`browse`, `scan-vault`, `save-sources`) enforce the following before any I/O:

1. **Canonicalize**: `path.resolve(input)` followed by `fs.realpath()` to resolve symlinks.
2. **Reject path traversal**: input MUST NOT contain `..` segments after `path.resolve`. (Belt and suspenders; `resolve` already normalizes, but we double-check.)
3. **Home-directory containment**: the canonicalized path MUST be inside `os.homedir()`. If not → 403 `{ error: "path_out_of_bounds" }`.
4. **No exposure outside loopback**: server already binds to `127.0.0.1` — no LAN exposure. Documented in ARCHITECTURE §14.

This is sufficient for a localhost-only personal tool. The threat model is "stop the user from accidentally configuring a path that leaks vault content to their local network". It is NOT designed to resist a malicious local actor.

A small helper `server/core/pathGuard.js` exposes a single function `assertPathSafe(input): string` that returns the canonical path on success and throws a typed error on failure. All endpoints use it before any other path operations.

## 6. Hot-reload of adapters

When `save-sources` succeeds, the new adapter list is built and swapped into the running aggregator WITHOUT restarting the Node process.

Mechanism:
- `server/core/aggregator.js` gains a `replaceAdapters(newAdapters)` method.
- Implementation: assigns the new array to the aggregator's internal `adapters` field, clears `previousSnapshot` (so we don't fire spurious completion diffs across the config change).
- `save-sources` route calls `aggregator.replaceAdapters([...new adapters from ADAPTER_REGISTRY...])` after the on-disk write succeeds.
- The HTTP routes hold the same aggregator reference; they pick up the new list on the next call.

In-flight requests against the old adapter list complete normally. New polling cycles use the new list. No coordination needed beyond the simple field swap (Node's single-threaded event loop guarantees atomicity for the swap itself).

## 7. Component structure

All new components live under `client/src/components/onboarding/`.

### 7.1 Files added

| File | Responsibility |
|---|---|
| `client/src/components/onboarding/OnboardingFlow.jsx` | Wizard shell; owns the state machine (§2.1) via `useReducer`. |
| `client/src/components/onboarding/ModePicker.jsx` | State MODE_PICK; two big buttons + (in settings mode) the ExistingSourcesList. |
| `client/src/components/onboarding/ExistingSourcesList.jsx` | Settings re-entry only. List of current sources with X remove buttons. |
| `client/src/components/onboarding/FileBrowser.jsx` | State BROWSE_FILES. Composes BrowserRow. Multi-select. |
| `client/src/components/onboarding/FolderBrowser.jsx` | State BROWSE_FOLDERS. Composes BrowserRow. Single-select. |
| `client/src/components/onboarding/BrowserRow.jsx` | Shared row: name, icon, badge (kanban / vault), click handler, selected state. |
| `client/src/components/onboarding/ScanProgress.jsx` | Transient state SCANNING. |
| `client/src/components/onboarding/ChecklistReview.jsx` | State REVIEW. Per-row checkbox + vault-name input. |
| `client/src/components/onboarding/ConfirmLoading.jsx` | Transient state SAVING + DONE. |
| `client/src/lib/setupApi.js` | Fetch wrappers: `getSetupStatus`, `browse`, `scanVault`, `saveSources`. |
| `client/src/hooks/useSetupStatus.js` | Fetches `/api/setup/status` on mount + provides a `refresh()` callback. |

### 7.2 Files modified

| File | Change |
|---|---|
| `client/src/App.jsx` | Add `setupNeeded` + `settingsOpen` state; conditional render of `<OnboardingFlow>`. Use `useSetupStatus`. |
| `client/src/hooks/useQuests.js` | When response has `meta.setupNeeded`, store it on the hook's return; don't treat empty quests as an error. |
| `client/src/components/HeaderHUD.jsx` | Add ⚙ Settings button next to ShowCompletedToggle; calls `onOpenSettings` prop from App. |

### 7.3 Backend files added

| File | Responsibility |
|---|---|
| `server/routes/setup.js` | The 4 endpoints (`status`, `browse`, `scan-vault`, `save-sources`). |
| `server/core/vaultScanner.js` | Recursive `.md` walker with frontmatter check + soft cap. |
| `server/core/pathGuard.js` | `assertPathSafe(input)` — canonicalize + home-dir containment + traversal rejection. |
| `server/core/configWriter.js` | `writeSourcesConfig(rootDir, sources)` — atomic write via `.tmp` + rename. |

### 7.4 Backend files modified

| File | Change |
|---|---|
| `server/index.js` | Mount `/api/setup` router. Pass aggregator + ADAPTER_REGISTRY to the setup route factory. Add the `setupNeeded` meta flag to `/api/quests` response when adapter list is empty. |
| `server/core/configLoader.js` | Return empty sources when `sources.json` is missing instead of throwing. |
| `server/core/aggregator.js` | Add `replaceAdapters(newAdapters)` method; clear previousSnapshot. |

## 8. Edge case behavior

| Scenario | Behavior |
|---|---|
| File browser deep in a directory with 10,000+ entries | Response capped at 500; `truncated: true`. UI shows "Showing 500 of N — narrow your path to see more". |
| `scan-vault` on a huge vault (5,000+ `.md` files) | Walk respects soft cap; returns `truncated: true`. UI shows "Scanned first 5,000 files — increase cap or split the vault". |
| Path contains `..` after canonicalization | 403 `{ error: "path_out_of_bounds" }` from `pathGuard.assertPathSafe`. UI shows a banner with the rejected path. |
| Symlink pointing outside `$HOME` | `fs.realpath` resolves it before the home-containment check → 403. |
| User picks the same file twice across modes / re-adds an existing source | `save-sources` dedupes on canonical `file` path. Server returns a soft warning per-row: `{ warning: "duplicate_skipped" }`. UI shows toast: "X is already configured — kept existing entry". |
| Checklist confirm with 0 rows checked | Confirm button disabled. Helper text "Select at least one board to continue". |
| Vault auto-detection finds no `.obsidian/` | `vaultName` returned as `null`. UI defaults the vault input to the parent directory's basename and shows a warning icon. User must fill before confirm. |
| Frontmatter check on a `.md` file errors (permission etc.) | Treated as "not a kanban board". Per-file error logged server-side. Not surfaced unless ≥10 errors in one scan → toast warning. |
| `config/sources.json` write fails (disk full, permission) | Atomic write semantics: `.tmp` file is created and renamed only on success. On failure: original file untouched, 500 response with `{ error: "write_failed", message }`. UI shows error + retry button. |
| Server boots with empty/missing config | `/api/setup/status` returns `setupNeeded: true`. Dashboard never renders; onboarding always shown. No stuck "INITIALIZING…" spinner. |
| User removes the last source from Settings | Save succeeds with `sources: []`. Aggregator's adapter list becomes empty. `setupNeeded` returns to true. Settings page closes; OnboardingFlow opens. |
| Settings flow navigated away mid-edit | No partial saves — config writes only happen at `save-sources` confirm. Closing Settings is always safe. |
| Browser tab loses focus mid-scan | Scan runs server-side; client gets the result whenever it returns. |
| Two browser tabs open onboarding simultaneously | Last `save-sources` wins. Previous tab's view becomes stale. Acceptable for a single-user tool. |
| Selected kanban file isn't actually a valid board on save | Per-source validation in `save-sources` rejects it with `{ error: "invalid_kanban", reason }`. UI marks the offending row in the checklist with the inline reason; user can uncheck it and retry. |

## 9. Testing strategy

### 9.1 Backend tests

| Test | File |
|---|---|
| `pathGuard` rejects paths outside `$HOME` | `server/tests/pathGuard.test.js` |
| `pathGuard` rejects paths containing `..` segments | same |
| `pathGuard` resolves symlinks before bounds check | same |
| `vaultScanner` finds files with `kanban-plugin: board` frontmatter | `server/tests/vaultScanner.test.js` |
| `vaultScanner` skips `.obsidian/`, hidden dirs, `node_modules/` | same |
| `vaultScanner` respects soft cap (sets `truncated: true`) | same |
| `vaultScanner` continues walk on per-file read errors | same |
| `configWriter` writes atomically (mid-write kill doesn't corrupt) | `server/tests/configWriter.test.js` |
| `loadConfig` returns empty sources when `sources.json` missing | `server/tests/configLoader.test.js` (existing file, new test added) |
| `aggregator.replaceAdapters` swaps list + clears previousSnapshot | `server/tests/aggregator.test.js` (new test) |
| `GET /api/setup/browse` returns correct entry kinds + badges | `server/tests/routes-setup.test.js` |
| `GET /api/setup/browse` returns 403 for out-of-bounds path | same |
| `POST /api/setup/scan-vault` returns kanban files + auto-detected vault name | same |
| `POST /api/setup/save-sources` writes config + rebuilds adapters | same |
| `POST /api/setup/save-sources` validates per-source; rejects invalid kanban | same |
| `POST /api/setup/save-sources` deduplicates by canonical file path | same |
| `GET /api/setup/status` returns `setupNeeded: true` when no sources | same |

### 9.2 Frontend tests

| Test | File |
|---|---|
| `setupApi.js` wrappers handle 200/403/500 | `client/src/tests/setupApi.test.js` |
| `ModePicker` fires correct handler per button | `client/src/tests/ModePicker.test.jsx` |
| `FileBrowser` renders entries; greys out non-kanban `.md`; selects on click | `client/src/tests/FileBrowser.test.jsx` |
| `ChecklistReview` pre-checks all rows; toggling excludes from payload; Confirm disabled at 0 selected | `client/src/tests/ChecklistReview.test.jsx` |
| `OnboardingFlow` state-machine transitions: MODE_PICK → BROWSE_FILES → REVIEW → SAVING → DONE | `client/src/tests/OnboardingFlow.test.jsx` |
| `OnboardingFlow` settings mode preceded by `<ExistingSourcesList>` | same |
| `useSetupStatus` exposes `setupNeeded` from response | (skip — hook is thin) |

### 9.3 Manual end-to-end

- Fresh install, no `config/sources.json` → server boots → frontend shows onboarding → pick vault → scan → checklist → confirm → dashboard loads
- Settings re-entry: add a 2nd source → dashboard reflects both
- Settings re-entry: remove a source → dashboard updates without restart
- Path-out-of-bounds attempt → 403 banner
- Vault without `.obsidian/`: vault name field is required + warning surfaces

## 10. Out of scope (v1.2)

- Drag-and-drop file selection
- Search-as-you-type filter in browser views
- Recently-used paths memory
- File watching for newly-added kanban files in a configured vault (v2 territory, alongside Google Tasks)
- Per-source category mapping overrides via UI (still hand-edit `categoryMap.js`)
- Mobile-responsive onboarding (desktop browser only)
- Migration of older `config/sources.json` schemas (v1 schema is the only one so far)
- Editing an existing source's path or vault name via UI (remove + re-add for now)

## 11. Roadmap position

v1.2 is a UX-refinement patch on top of v1.1. Does not block, depend on, or change the v2 (Google Tasks) or v3 (Calendar) roadmap. The adapter abstraction continues to be the integration point for those.
