# Quest Dashboard — v1.3 Spec: Activity Tracker

**Version**: 1.3 (delta-spec on top of v1.2)
**Date**: 2026-05-27
**Status**: Approved, ready for implementation plan
**Parent docs**: [SPEC.md](SPEC.md), [SPEC-v1.1-subtasks.md](SPEC-v1.1-subtasks.md), [SPEC-v1.2-onboarding.md](SPEC-v1.2-onboarding.md)

---

## 1. Motivation

The streak counter in the header HUD shows the *current* run of consecutive active days but reveals nothing about historical patterns — was the user grinding hard last week? Have they been consistent for months, or just on a hot streak? A GitHub-style activity tracker gives that context at a glance.

## 2. Visual Design

A 7-row × 13-column grid of small tiles, immediately below the existing streak/rolling-avg line in the header HUD. **7 rows = days of the week (Sun → Sat). Each column = one week.** The rightmost column is the current week. Tiles fill column-by-column, top-to-bottom.

```
Sun  ▢▢▢▢▢▢▢▢▢▢▢▢▢
Mon  ▢▢▢▢▢▢▢▢▢▢▢▢▢
Tue  ▢▢▢▢▢▢▢▢▢▢▢▢▢
Wed  ▢▢▢▣▢▣▢▢▢▣▣▢▢
Thu  ▢▢▣▢▢▣▢▣▢▣▣▢▣
Fri  ▢▢▢▢▢▢▢▢▣▢▣▢▣
Sat  ▢▢▢▢▢▢▢▢▢▢▣▣▣
     └───────────────┘
     13 weeks ago → this week
```

**Tile dimensions**: ~10×10 px CSS pixels with ~2 px gap. Total widget footprint ≈ 156 px wide × 84 px tall — fits in the header without dominating.

**Future tiles**: cells representing dates after today (within the current week's column) render as the empty bucket.

## 3. Bucketing

For each day's XP total `xp` and daily target `T` from `config/targets.json` (default `T=50`):

| Bucket | XP range | Tile visual | Semantic |
|---|---|---|---|
| 0 | `xp == 0` | `hud-border` at ~30% opacity | No activity |
| 1 | `0 < xp ≤ 0.25 * T` | `hud-accent` at 25% opacity | Low |
| 2 | `0.25*T < xp ≤ 0.75*T` | `hud-accent` at 50% opacity | Medium |
| 3 | `0.75*T < xp ≤ 1.25*T` | `hud-accent` at 75% opacity | Around-goal |
| 4 | `xp > 1.25*T` | `hud-accent` at 100% opacity + subtle text-shadow glow | Goal smashed |

With default T=50: thresholds are 0 / 1–12 / 13–37 / 38–62 / 63+.

## 4. Hover behavior

Each tile gets a native `title` attribute: `"YYYY-MM-DD — N XP"`. Browser-native tooltip on hover. No custom tooltip component needed for v1.3.

Future-date tiles get a title like `"YYYY-MM-DD — (future)"` so the user knows the tile means "this hasn't happened yet" rather than "no activity recorded".

## 5. Data window

The widget always renders exactly **91 tiles = 13 weeks × 7 days**, ending with the rightmost column = the current calendar week (Sun–Sat, local time). The first column = the week 12 weeks before this one.

This is **~90 days but aligned to week boundaries**. The window slides by exactly 1 week every Sunday (locally). All other days, the same 91 cells are shown (today's tile just shifts down its column as the week progresses).

## 6. Backend Changes

### 6.1 New method on `historyStore`

```js
/**
 * Aggregate XP totals by ISO date (YYYY-MM-DD) across all events
 * in [startDate, endDate]. Returns a Map keyed by date string.
 */
async dailyXpByDate(startDate, endDate)
```

Implementation: read all events via existing `readAll()`, filter to the range, sum XP per ISO date. Returns `Map<string, number>`. Empty Map when no events.

### 6.2 `GET /api/history` extension

Existing response shape unchanged. Adds one new field:

```json
{
  "today": { ... },
  "week": { ... },
  "rollingAvg7Day": { ... },
  "streak": 4,
  "totalDays": 23,
  "useRollingAvg": true,
  "dailyActivity": [
    { "date": "2026-02-22", "xp": 0 },
    { "date": "2026-02-23", "xp": 15 },
    ...
    { "date": "2026-05-30", "xp": 0 }
  ]
}
```

`dailyActivity` is **always exactly 91 entries**, oldest first. The route computes:

1. `endOfWeek` = upcoming Saturday (or today if today is Saturday) — local time.
2. `startOfWindow` = `endOfWeek - 90 days` (= 12 weeks before, on a Sunday).
3. For each date in `[startOfWindow, endOfWeek]` (inclusive, 91 days), emit `{ date, xp }`. `xp` is from `dailyXpByDate`, or 0 if no events.

This means future-date tiles (dates after today in the current week's column) are present in the response with `xp: 0`.

## 7. Frontend Changes

### 7.1 New component `ActivityTracker`

`client/src/components/ActivityTracker.jsx`. Props:

```ts
interface Props {
  dailyActivity: { date: string, xp: number }[]; // exactly 91 entries, oldest first
  dailyTarget: number;                            // for bucketing
}
```

Renders a CSS grid:

```jsx
<div
  className="grid gap-[2px] grid-rows-7"
  style={{ gridAutoFlow: 'column', gridTemplateRows: 'repeat(7, 0.6rem)' }}
>
  {dailyActivity.map(({ date, xp }) => (
    <div
      key={date}
      title={tileTitle(date, xp)}
      className={`w-[0.6rem] h-[0.6rem] ${bucketClass(xp, dailyTarget, date)}`}
    />
  ))}
</div>
```

Helpers:
- `bucketClass(xp, target, date)`: returns a Tailwind class for the tile's color/opacity (per §3). Special case: if `date > today (ISO)`, return the empty bucket class.
- `tileTitle(date, xp)`: returns `"YYYY-MM-DD — N XP"` for past/today, `"YYYY-MM-DD — (future)"` otherwise.

The grid uses **`gridAutoFlow: 'column'`** with **7 explicit rows** so 91 items fill 13 columns of 7 days each.

### 7.2 `HeaderHUD` integration

Below the existing streak/rolling-avg line, add:

```jsx
{history?.dailyActivity && (
  <div className="mt-3">
    <ActivityTracker
      dailyActivity={history.dailyActivity}
      dailyTarget={history.today?.target ?? 50}
    />
  </div>
)}
```

If `dailyActivity` isn't present (e.g., from a hook update that hasn't returned yet, or older history payload), the widget simply doesn't render.

### 7.3 No changes elsewhere

- `useHistory` hook needs no code change — `dailyActivity` flows through transparently.
- No new lib functions, no new hooks.

## 8. Testing strategy

### 8.1 Backend tests

| Test | File |
|---|---|
| `dailyXpByDate` sums XP per ISO date across events | `server/tests/historyStore.test.js` (new test) |
| `dailyXpByDate` returns empty Map when no events in range | same |
| `dailyXpByDate` excludes events outside the [start, end] range | same |
| `GET /api/history` returns `dailyActivity` array of length 91 | `server/tests/routes.test.js` (history-route test extended) |
| `dailyActivity` entries are ordered oldest-first | same |
| `dailyActivity` covers a contiguous 91-day window ending the upcoming Saturday | same |
| `dailyActivity` zero-fills days with no XP events | same |

### 8.2 Frontend tests

| Test | File |
|---|---|
| `ActivityTracker` renders 91 tiles | `client/src/tests/ActivityTracker.test.jsx` |
| Empty-XP day gets the bucket-0 class | same |
| Day with `xp > 1.25 * target` gets the bucket-4 class | same |
| Day around target (e.g., 90% of target) gets the bucket-3 class | same |
| Future-date tile gets the bucket-0 class regardless of xp value | same |
| Tile `title` contains the date | same |
| Tile `title` for future dates says "(future)" | same |

## 9. Edge cases

| Scenario | Behavior |
|---|---|
| User has zero history (fresh install, no backfill, no completions) | All 91 tiles render as bucket-0 (faint grey grid). No errors. |
| `config/targets.json` is missing | Falls back to default `{ daily: 50, weekly: 250 }`. Bucketing uses default `T=50`. |
| User changes `daily` target in config + restarts | All tiles re-bucket with the new target on the next render. No backend persistence concern. |
| Server returns malformed `dailyActivity` (wrong length, missing dates) | Frontend renders whatever's there; widget gracefully shows partial grid. No throw. (Defensive but no validation logic.) |
| User's timezone causes a date-boundary anomaly | All date math uses local time on both server and client. Same-host architecture means timezone is consistent. Acceptable. |
| Long XP events (e.g., a 200-XP quest completion) saturate bucket 4 | Bucket 4 is "anything above 1.25× target" — saturates intentionally. No visual differentiation between 1.5× target and 5× target. |

## 10. Out of scope (v1.3)

- Click-to-filter ("show me only quests from this day")
- Rich custom tooltip with quest titles and breakdowns
- Configurable time range (locked at 91 days / 13 weeks)
- Adaptive bucketing (locked at relative-to-target — see SPEC §3)
- Date axis labels (month markers below the grid)
- Day-of-week labels on the left edge
- Color customization beyond the existing `hud-accent` palette
- Animation / transitions on bucket changes

## 11. Roadmap position

v1.3 is a UI polish addition. Independent of v2 (Google Tasks) and v3 (Calendar). Doesn't touch the adapter abstraction, doesn't add new sources, doesn't change scoring.
