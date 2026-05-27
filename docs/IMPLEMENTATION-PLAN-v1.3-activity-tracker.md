# Quest Dashboard v1.3 — Activity Tracker Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a GitHub-style 7-row × 13-column activity grid below the streak counter in `HeaderHUD`, visualizing daily XP totals across the last ~90 days, with 5 intensity buckets relative to the daily XP target.

**Architecture:** Backend gets one new helper (`historyStore.dailyXpByDate`) and one extended response field on `GET /api/history` (`dailyActivity`: 91 entries of `{ date, xp }`). Frontend gets one new component (`ActivityTracker`) wired into the existing `HeaderHUD`. No new endpoints, hooks, libraries, or routes.

**Tech Stack:** Same as v1 + v1.1 + v1.2 — Node + Express + Vitest backend, Vite + React + Tailwind + Testing Library frontend.

**Companion docs:** [SPEC-v1.3-activity-tracker.md](SPEC-v1.3-activity-tracker.md), [SPEC.md](SPEC.md), [ARCHITECTURE.md](ARCHITECTURE.md)

---

## Phase 1: Backend

### Task 1: `historyStore.dailyXpByDate`

**Files:**
- Modify: `server/core/historyStore.js`
- Modify: `server/tests/historyStore.test.js`

- [ ] **Step 1: Append failing tests**

Add to `server/tests/historyStore.test.js`:

```js
describe('historyStore — dailyXpByDate', () => {
  test('sums XP per ISO date across events in the window', async () => {
    const store = createHistoryStore(storePath);
    await store.appendBatch([
      { questId: 'a', xp: 10, ts: '2026-05-18T10:00:00Z', source: 'o', title: 'a' },
      { questId: 'b', xp: 25, ts: '2026-05-18T15:30:00Z', source: 'o', title: 'b' },
      { questId: 'c', xp: 30, ts: '2026-05-19T09:00:00Z', source: 'o', title: 'c' },
    ]);
    const map = await store.dailyXpByDate(
      new Date('2026-05-18T00:00:00Z'),
      new Date('2026-05-20T23:59:59Z')
    );
    expect(map.get('2026-05-18')).toBe(35);
    expect(map.get('2026-05-19')).toBe(30);
    expect(map.size).toBe(2);
  });

  test('returns empty Map when no events in range', async () => {
    const store = createHistoryStore(storePath);
    await store.appendEvent({ questId: 'q1', xp: 10, ts: '2026-01-01T10:00:00Z', source: 'o', title: 't' });
    const map = await store.dailyXpByDate(
      new Date('2026-05-01T00:00:00Z'),
      new Date('2026-05-31T23:59:59Z')
    );
    expect(map.size).toBe(0);
  });

  test('excludes events outside the window', async () => {
    const store = createHistoryStore(storePath);
    await store.appendBatch([
      { questId: 'before', xp: 10, ts: '2026-05-17T10:00:00Z', source: 'o', title: 'b' },
      { questId: 'in', xp: 20, ts: '2026-05-18T10:00:00Z', source: 'o', title: 'i' },
      { questId: 'after', xp: 30, ts: '2026-05-19T10:00:00Z', source: 'o', title: 'a' },
    ]);
    const map = await store.dailyXpByDate(
      new Date('2026-05-18T00:00:00Z'),
      new Date('2026-05-18T23:59:59Z')
    );
    expect(map.size).toBe(1);
    expect(map.get('2026-05-18')).toBe(20);
  });

  test('returns empty Map when log file does not exist', async () => {
    const store = createHistoryStore(storePath);
    const map = await store.dailyXpByDate(
      new Date('2026-05-01T00:00:00Z'),
      new Date('2026-05-31T23:59:59Z')
    );
    expect(map.size).toBe(0);
  });
});
```

- [ ] **Step 2: Run tests — verify RED**

```bash
npm test --workspace=server
```

Expected: `dailyXpByDate` tests fail with `store.dailyXpByDate is not a function`. 197 prior tests still pass.

- [ ] **Step 3: Add `dailyXpByDate` to `server/core/historyStore.js`**

Open `server/core/historyStore.js`. Inside the `createHistoryStore` factory's `api` object (alongside `sumXpInWindow`, `rollingDailyAverage`, etc.), add this method:

```js
    async dailyXpByDate(startDate, endDate) {
      const events = await api.readAll();
      const result = new Map();
      const startMs = startDate.getTime();
      const endMs = endDate.getTime();
      for (const e of events) {
        const ts = new Date(e.ts).getTime();
        if (ts < startMs || ts > endMs) continue;
        const isoDay = isoDate(new Date(e.ts));
        result.set(isoDay, (result.get(isoDay) || 0) + (e.xp || 0));
      }
      return result;
    },
```

Place it before the closing `};` of the api object. The `isoDate` helper at the bottom of the file is already defined and reusable.

- [ ] **Step 4: Run tests — verify GREEN**

```bash
npm test --workspace=server
```

Expected: 201 tests pass (197 + 4 new). All existing historyStore tests still pass.

- [ ] **Step 5: Commit**

```bash
git add server/core/historyStore.js server/tests/historyStore.test.js
git commit -m "feat(core): historyStore.dailyXpByDate — sum XP per ISO date in a window"
```

Do NOT stage `.bak` files, `config/`, `data/`, or the stray `" "` file at repo root.

---

### Task 2: Extend `/api/history` with `dailyActivity` array

**Files:**
- Modify: `server/routes/history.js`
- Modify: `server/tests/routes.test.js`

- [ ] **Step 1: Append failing tests to `server/tests/routes.test.js`**

```js
describe('GET /api/history — dailyActivity (v1.3)', () => {
  test('returns dailyActivity array of length 91', async () => {
    const built = await buildApp();
    built.app.use('/api/history', createHistoryRoute({ history: built.history, targets: { daily: 50, weekly: 250 } }));
    try {
      const res = await request(built.app).get('/api/history');
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.dailyActivity)).toBe(true);
      expect(res.body.dailyActivity).toHaveLength(91);
    } finally {
      await fs.rm(built.tmpDir, { recursive: true, force: true });
    }
  });

  test('dailyActivity entries are ordered oldest-first', async () => {
    const built = await buildApp();
    built.app.use('/api/history', createHistoryRoute({ history: built.history, targets: { daily: 50, weekly: 250 } }));
    try {
      const res = await request(built.app).get('/api/history');
      const dates = res.body.dailyActivity.map(d => d.date);
      const sorted = [...dates].sort();
      expect(dates).toEqual(sorted);
    } finally {
      await fs.rm(built.tmpDir, { recursive: true, force: true });
    }
  });

  test('dailyActivity ends on the upcoming Saturday (or today if Saturday)', async () => {
    const built = await buildApp();
    built.app.use('/api/history', createHistoryRoute({ history: built.history, targets: { daily: 50, weekly: 250 } }));
    try {
      const res = await request(built.app).get('/api/history');
      const last = res.body.dailyActivity[res.body.dailyActivity.length - 1];
      const lastDate = new Date(`${last.date}T00:00:00`);
      // Last date must be a Saturday (getDay() === 6) in local time.
      expect(lastDate.getDay()).toBe(6);
      // Last date must be today or in the future (the upcoming Saturday).
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      expect(lastDate.getTime()).toBeGreaterThanOrEqual(today.getTime());
    } finally {
      await fs.rm(built.tmpDir, { recursive: true, force: true });
    }
  });

  test('dailyActivity zero-fills days with no XP events', async () => {
    const built = await buildApp();
    built.app.use('/api/history', createHistoryRoute({ history: built.history, targets: { daily: 50, weekly: 250 } }));
    try {
      const res = await request(built.app).get('/api/history');
      // The buildApp helper creates an empty history file — every day should have xp=0.
      const totals = res.body.dailyActivity.map(d => d.xp);
      expect(totals.every(xp => xp === 0)).toBe(true);
    } finally {
      await fs.rm(built.tmpDir, { recursive: true, force: true });
    }
  });
});
```

- [ ] **Step 2: Run tests — verify RED**

```bash
npm test --workspace=server
```

Expected: new `dailyActivity` tests fail (`dailyActivity` is undefined in the response). All 201 prior tests still pass.

- [ ] **Step 3: REPLACE the content of `server/routes/history.js` with**:

```js
import { Router } from 'express';

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

export function createHistoryRoute({ history, targets }) {
  const router = Router();

  router.get('/', async (req, res, next) => {
    try {
      const now = new Date();
      const startOfToday = new Date(now);
      startOfToday.setHours(0, 0, 0, 0);
      const endOfToday = new Date(startOfToday.getTime() + ONE_DAY_MS - 1);

      const dayOfWeek = (now.getDay() + 6) % 7; // 0 = Monday
      const startOfWeek = new Date(startOfToday.getTime() - dayOfWeek * ONE_DAY_MS);
      const endOfWeek = new Date(startOfWeek.getTime() + 7 * ONE_DAY_MS - 1);

      const todayXp = await history.sumXpInWindow(startOfToday, endOfToday);
      const weekXp = await history.sumXpInWindow(startOfWeek, endOfWeek);
      const rollingDaily = await history.rollingDailyAverage(endOfToday, 7);
      const rollingWeekly = rollingDaily * 7;
      const streak = await history.streakDays(endOfToday);
      const allEvents = await history.readAll();
      const totalDays = new Set(allEvents.map(e => e.ts.slice(0, 10))).size;

      // v1.3 activity tracker: 91 days ending the upcoming Saturday (or today if Saturday).
      const daysUntilSat = (6 - now.getDay() + 7) % 7;
      const upcomingSat = new Date(startOfToday.getTime() + daysUntilSat * ONE_DAY_MS);
      const upcomingSatEnd = new Date(upcomingSat.getTime() + ONE_DAY_MS - 1);
      const windowStart = new Date(upcomingSat.getTime() - 90 * ONE_DAY_MS);
      const dailyXpMap = await history.dailyXpByDate(windowStart, upcomingSatEnd);
      const dailyActivity = [];
      for (let i = 0; i < 91; i++) {
        const d = new Date(windowStart.getTime() + i * ONE_DAY_MS);
        const isoDay = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        dailyActivity.push({ date: isoDay, xp: dailyXpMap.get(isoDay) || 0 });
      }

      res.json({
        today: { xp: todayXp, target: targets.daily },
        week: { xp: weekXp, target: targets.weekly },
        rollingAvg7Day: { daily: Math.round(rollingDaily), weekly: Math.round(rollingWeekly) },
        streak,
        totalDays,
        useRollingAvg: totalDays >= 7,
        dailyActivity,
      });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
```

The new logic computes the upcoming Saturday (or today if it IS Saturday) using `(6 - now.getDay() + 7) % 7`, then builds 91 entries from `(upcomingSat - 90 days)` through `upcomingSat` inclusive. The ISO date string is built from local-time `getFullYear()`/`getMonth()`/`getDate()` so it matches the local calendar day.

- [ ] **Step 4: Run tests — verify GREEN**

```bash
npm test --workspace=server
```

Expected: 205 tests pass (201 + 4 new). All existing history-route tests still pass.

- [ ] **Step 5: Commit**

```bash
git add server/routes/history.js server/tests/routes.test.js
git commit -m "feat(routes): /api/history returns 91-day dailyActivity for the tracker grid"
```

Do NOT stage `.bak` files, `config/`, `data/`, or the stray `" "` file.

---

## Phase 2: Frontend

### Task 3: `ActivityTracker` component

**Files:**
- Create: `client/src/components/ActivityTracker.jsx`
- Create: `client/src/tests/ActivityTracker.test.jsx`

- [ ] **Step 1: Write failing tests**

Create `client/src/tests/ActivityTracker.test.jsx`:

```jsx
import { describe, test, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ActivityTracker } from '../components/ActivityTracker.jsx';

function makeData(length = 91, xpAt = {}) {
  // Generate `length` entries ending today; xpAt maps index -> xp value.
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const items = [];
  for (let i = length - 1; i >= 0; i--) {
    const d = new Date(today.getTime() - i * 24 * 60 * 60 * 1000);
    const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    items.push({ date: iso, xp: xpAt[length - 1 - i] ?? 0 });
  }
  return items;
}

describe('ActivityTracker', () => {
  test('renders exactly 91 tiles', () => {
    render(<ActivityTracker dailyActivity={makeData(91)} dailyTarget={50} />);
    const tiles = screen.getAllByTitle(/^\d{4}-\d{2}-\d{2}/);
    expect(tiles).toHaveLength(91);
  });

  test('empty-XP day gets bucket-0 class', () => {
    const data = makeData(91, { 50: 0 });  // index 50 has xp=0
    render(<ActivityTracker dailyActivity={data} dailyTarget={50} />);
    const tile = screen.getByTitle(new RegExp(`${data[50].date}`));
    expect(tile.className).toContain('bg-hud-border/30');
  });

  test('day exceeding 125% of target gets bucket-4 class (full opacity)', () => {
    const data = makeData(91, { 50: 100 });  // 100 > 1.25 * 50
    render(<ActivityTracker dailyActivity={data} dailyTarget={50} />);
    const tile = screen.getByTitle(new RegExp(`${data[50].date}`));
    expect(tile.className).toMatch(/bg-hud-accent(?!\/)/);  // bg-hud-accent without an opacity modifier
  });

  test('around-target day (90% of target) gets bucket-3 class', () => {
    const data = makeData(91, { 50: 45 });  // 0.75*50 < 45 <= 1.25*50
    render(<ActivityTracker dailyActivity={data} dailyTarget={50} />);
    const tile = screen.getByTitle(new RegExp(`${data[50].date}`));
    expect(tile.className).toContain('bg-hud-accent/75');
  });

  test('future-date tile gets bucket-0 class regardless of xp value', () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const future = new Date(today.getTime() + 2 * 24 * 60 * 60 * 1000);
    const futureIso = `${future.getFullYear()}-${String(future.getMonth() + 1).padStart(2, '0')}-${String(future.getDate()).padStart(2, '0')}`;
    const data = [...makeData(90), { date: futureIso, xp: 999 }];
    render(<ActivityTracker dailyActivity={data} dailyTarget={50} />);
    const tile = screen.getByTitle(new RegExp(`${futureIso}`));
    expect(tile.className).toContain('bg-hud-border/30');
  });

  test('tile title contains the date and XP', () => {
    const data = makeData(91, { 50: 27 });
    render(<ActivityTracker dailyActivity={data} dailyTarget={50} />);
    expect(screen.getByTitle(`${data[50].date} — 27 XP`)).toBeInTheDocument();
  });

  test('tile title for future dates says "(future)"', () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const future = new Date(today.getTime() + 1 * 24 * 60 * 60 * 1000);
    const futureIso = `${future.getFullYear()}-${String(future.getMonth() + 1).padStart(2, '0')}-${String(future.getDate()).padStart(2, '0')}`;
    const data = [{ date: futureIso, xp: 0 }];
    render(<ActivityTracker dailyActivity={data} dailyTarget={50} />);
    expect(screen.getByTitle(`${futureIso} — (future)`)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run tests — verify RED**

```bash
npm test --workspace=client
```

Expected: `ActivityTracker` tests fail (module not found). 64 prior tests pass.

- [ ] **Step 3: Implement `client/src/components/ActivityTracker.jsx`**

```jsx
function todayIso() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function bucketClass(xp, target, date, todayStr) {
  if (date > todayStr) return 'bg-hud-border/30';
  if (xp === 0) return 'bg-hud-border/30';
  const ratio = target > 0 ? xp / target : 0;
  if (ratio <= 0.25) return 'bg-hud-accent/25';
  if (ratio <= 0.75) return 'bg-hud-accent/50';
  if (ratio <= 1.25) return 'bg-hud-accent/75';
  return 'bg-hud-accent';
}

function tileTitle(date, xp, todayStr) {
  if (date > todayStr) return `${date} — (future)`;
  return `${date} — ${xp} XP`;
}

export function ActivityTracker({ dailyActivity, dailyTarget }) {
  const today = todayIso();
  return (
    <div
      className="grid gap-[2px]"
      style={{ gridAutoFlow: 'column', gridTemplateRows: 'repeat(7, 0.6rem)' }}
    >
      {dailyActivity.map(({ date, xp }) => (
        <div
          key={date}
          title={tileTitle(date, xp, today)}
          className={`w-[0.6rem] h-[0.6rem] ${bucketClass(xp, dailyTarget, date, today)}`}
        />
      ))}
    </div>
  );
}
```

The literal class strings (`bg-hud-border/30`, `bg-hud-accent/25`, `bg-hud-accent/50`, `bg-hud-accent/75`, `bg-hud-accent`) are present as exact tokens in the source so Tailwind's JIT picks them up.

- [ ] **Step 4: Run tests — verify GREEN**

```bash
npm test --workspace=client
```

Expected: 71 tests pass (64 + 7 new).

- [ ] **Step 5: Commit**

```bash
git add client/src/components/ActivityTracker.jsx client/src/tests/ActivityTracker.test.jsx
git commit -m "feat(client): ActivityTracker 7×13 grid with 5 intensity buckets"
```

Do NOT stage `.bak` files.

---

### Task 4: Integrate `ActivityTracker` into `HeaderHUD`

**Files:**
- Modify: `client/src/components/HeaderHUD.jsx`

- [ ] **Step 1: Read the current `HeaderHUD.jsx`**

```bash
cat client/src/components/HeaderHUD.jsx
```

Locate the closing `</header>` tag and the `<div className="mt-2 flex items-center gap-4 text-xs">` block that contains `<StreakBadge>` and the rolling-avg span.

- [ ] **Step 2: Add the import + render the tracker**

Add this import at the top of `HeaderHUD.jsx` (next to the existing component imports):

```jsx
import { ActivityTracker } from './ActivityTracker.jsx';
```

Inside the component function, AFTER the existing `<div className="mt-2 flex items-center gap-4 text-xs">...</div>` block (which contains the streak + rolling-avg) and BEFORE the closing `</header>`, add:

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

The conditional ensures the widget doesn't render if `dailyActivity` isn't present (defensive against older API responses or in-flight initial loads).

- [ ] **Step 3: Run tests — verify no regressions**

```bash
npm test --workspace=client
```

Expected: 71 tests still pass (HeaderHUD has no dedicated tests).

- [ ] **Step 4: Production build**

```bash
npm run build --workspace=client
```

Expected: `vite build` succeeds with no errors.

- [ ] **Step 5: Commit**

```bash
git add client/src/components/HeaderHUD.jsx
git commit -m "feat(client): wire ActivityTracker into HeaderHUD below streak/avg line"
```

Do NOT stage `.bak` files.

---

## Phase 3: Verification

### Task 5: Final verification + push + DEVLOG

**Files:**
- Modify: `DEVLOG.md`

- [ ] **Step 1: Run full test suites**

```bash
npm test --workspace=server
npm test --workspace=client
```

Expected: 205 server + 71 client = 276 total tests passing.

- [ ] **Step 2: Production build**

```bash
npm run build --workspace=client
```

Expected: clean build.

- [ ] **Step 3: Add DEVLOG entry**

Open `DEVLOG.md` and append a new section under the current `## 2026-05-27` heading (before the `---` separator that precedes `## Current state`):

```markdown
### v1.3 activity tracker

Shipped a GitHub-style activity grid below the streak/rolling-avg line in the header HUD. 7 rows (days of week, Sun→Sat) × 13 columns (weeks), 91 tiles total. Tile opacity buckets relative to daily XP target: 0 (no activity), 25% (1–25% of target), 50% (25–75%), 75% (75–125%), 100% (>125%). Native `title` tooltip per tile.

Backend: new `historyStore.dailyXpByDate(start, end)` method aggregates XP per ISO date; `GET /api/history` extended with a `dailyActivity` array (always 91 entries, oldest first, ends on the upcoming Saturday).

Frontend: new `ActivityTracker` component (CSS grid with `gridAutoFlow: 'column'` + 7 explicit rows so 91 items fill 13 columns of 7). Wired into `HeaderHUD` with a defensive guard so older API responses don't break it.

Verified: 205 server + 71 client = 276 tests passing. Production build clean.
```

Also update the "Current state" snapshot block: change the tests line from `197` to `276`.

- [ ] **Step 4: Commit the DEVLOG**

```bash
git add DEVLOG.md
git commit -m "docs(devlog): log v1.3 activity tracker"
```

- [ ] **Step 5: Push to public main**

The current branch should be `main` (this plan executes directly on main since v1.3 is a small additive feature). If on a feature branch, fast-forward merge into main first:

```bash
git branch --show-current
```

If on main: `git push origin main`. Otherwise: `git checkout main && git merge --ff-only <branch> && git push origin main`.

- [ ] **Step 6: Tag v1.3.0**

```bash
git tag -a v1.3.0 -m "v1.3.0 — activity tracker

Adds a GitHub-style 7×13 grid below the streak counter visualizing
the last ~90 days of XP activity. Tile opacity buckets relative to
daily XP target. Native title tooltips per tile.

Backend: historyStore.dailyXpByDate + /api/history dailyActivity field.
Frontend: ActivityTracker component wired into HeaderHUD."
git push origin v1.3.0
```

- [ ] **Step 7: Browser smoke (user-driven)**

The user opens `http://localhost:5274/`, hard-refreshes, and confirms the activity grid appears below the streak line. They should see:
- A 7×13 grid of tiles
- Tiles tinted according to their XP activity (most cells dim if low recent activity)
- Hover over a tile shows a tooltip: `2026-XX-XX — N XP`
- Today's tile is in the rightmost column at the appropriate day-of-week row

If something looks wrong (grid not appearing, wrong colors, wrong tooltips), report back for follow-up.

---

## Self-Review Checklist

- [ ] **Spec coverage** — every section of [SPEC-v1.3-activity-tracker.md](SPEC-v1.3-activity-tracker.md) maps to a task:
  - §2 Visual placement → Task 4 (HeaderHUD integration)
  - §3 Bucketing → Task 3 (`bucketClass` in ActivityTracker)
  - §4 Hover → Task 3 (`tileTitle` + `title` attribute)
  - §5 Data window (91 tiles, week-aligned) → Task 2 (route logic)
  - §6 Backend: `dailyXpByDate` → Task 1
  - §6 Backend: `/api/history` extension → Task 2
  - §7 Frontend: ActivityTracker → Task 3
  - §7 Frontend: HeaderHUD integration → Task 4
  - §8 Testing → tests embedded in each task
  - §9 Edge cases — zero history → Task 3 test (all bucket-0), Task 1 test (empty Map)
  - §9 Edge cases — missing config → existing default-on-missing from v1.2
  - §9 Edge cases — future-date tile → Task 3 tests
- [ ] **All tests passing** (205 server + 71 client = 276)
- [ ] **Production build succeeds**
- [ ] **No `TODO`, `TBD`, or placeholder strings remain in code**
