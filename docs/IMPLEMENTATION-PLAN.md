# Quest Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

> **v1.1 follow-on**: See [IMPLEMENTATION-PLAN-v1.1-subtasks.md](IMPLEMENTATION-PLAN-v1.1-subtasks.md) for interactive-subtask work that ships on top of v1.

**Goal:** Build a v1 MVP of the Quest Dashboard — a local-only web app that reads tasks from an Obsidian kanban file, presents them as cyberpunk-HUD-styled "quests" with XP scoring + progress bars, and supports bidirectional sync (mark-complete writes back to the kanban).

**Architecture:** Node + Express backend with a pluggable `SyncAdapter` interface (only `ObsidianAdapter` implemented in v1). Vite + React + Tailwind frontend, communicating via JSON over HTTP. Flat-file storage (JSON config, JSONL XP history). See [ARCHITECTURE.md](ARCHITECTURE.md) for full design.

**Tech Stack:**
- Backend: Node 20+, Express 4.x, Vitest (testing)
- Frontend: Vite 5.x, React 18.x, Tailwind 3.x, Vitest + @testing-library/react
- Build/dev: npm workspaces (single root `package.json` with workspaces for `server` and `client`)
- Markdown: custom parser for Obsidian kanban-plugin format

**Companion docs:** [PRD.md](PRD.md), [SPEC.md](SPEC.md), [ARCHITECTURE.md](ARCHITECTURE.md), [USER-STORIES.md](USER-STORIES.md)

---

## Phase 0: Project Initialization

### Task 0.1: Initialize npm workspace root

**Files:**
- Create: `package.json`
- Create: `.nvmrc`
- Create: `README.md`

- [ ] **Step 1: Create `.nvmrc` with Node version**

```bash
echo "20" > .nvmrc
```

- [ ] **Step 2: Create root `package.json` with workspaces**

```json
{
  "name": "quest-dashboard",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "workspaces": [
    "server",
    "client"
  ],
  "scripts": {
    "dev": "npm run dev --workspaces --if-present",
    "build": "npm run build --workspace=client",
    "start": "node server/index.js",
    "test": "npm run test --workspaces --if-present"
  },
  "devDependencies": {
    "concurrently": "^8.2.2"
  }
}
```

- [ ] **Step 3: Create minimal `README.md`**

```markdown
# Quest Dashboard

A personal RPG-styled task dashboard. See `docs/` for full design.

## Quick start

```bash
nvm use
npm install
npm run dev       # backend on :3000, frontend on :5173
```

## Status

v1 MVP in development.
```

- [ ] **Step 4: Commit**

```bash
git add package.json .nvmrc README.md
git commit -m "chore: init npm workspace root"
```

---

### Task 0.2: Scaffold server workspace

**Files:**
- Create: `server/package.json`
- Create: `server/index.js` (placeholder)
- Create: `server/adapters/.gitkeep`
- Create: `server/core/.gitkeep`
- Create: `server/routes/.gitkeep`
- Create: `server/parsers/.gitkeep`
- Create: `server/tests/.gitkeep`

- [ ] **Step 1: Create `server/package.json`**

```json
{
  "name": "@quest-dashboard/server",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "main": "index.js",
  "scripts": {
    "dev": "node --watch index.js",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "express": "^4.19.2"
  },
  "devDependencies": {
    "vitest": "^1.6.0"
  }
}
```

- [ ] **Step 2: Create placeholder `server/index.js`**

```js
// Placeholder — replaced in Task 11.1
console.log("Quest Dashboard server placeholder");
```

- [ ] **Step 3: Create empty subdirectories with `.gitkeep`**

```bash
mkdir -p server/adapters server/core server/routes server/parsers server/tests
touch server/adapters/.gitkeep server/core/.gitkeep server/routes/.gitkeep server/parsers/.gitkeep server/tests/.gitkeep
```

- [ ] **Step 4: Install server dependencies**

```bash
npm install --workspace=server
```

- [ ] **Step 5: Commit**

```bash
git add server/ package-lock.json
git commit -m "chore: scaffold server workspace"
```

---

### Task 0.3: Scaffold client workspace with Vite + React + Tailwind

**Files:**
- Create: `client/package.json`
- Create: `client/index.html`
- Create: `client/vite.config.js`
- Create: `client/tailwind.config.js`
- Create: `client/postcss.config.js`
- Create: `client/src/main.jsx`
- Create: `client/src/App.jsx`
- Create: `client/src/styles/index.css`

- [ ] **Step 1: Create `client/package.json`**

```json
{
  "name": "@quest-dashboard/client",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "react": "^18.3.1",
    "react-dom": "^18.3.1"
  },
  "devDependencies": {
    "@testing-library/jest-dom": "^6.4.5",
    "@testing-library/react": "^16.0.0",
    "@vitejs/plugin-react": "^4.3.1",
    "autoprefixer": "^10.4.19",
    "jsdom": "^24.1.0",
    "postcss": "^8.4.39",
    "tailwindcss": "^3.4.4",
    "vite": "^5.3.1",
    "vitest": "^1.6.0"
  }
}
```

- [ ] **Step 2: Create `client/index.html`**

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Quest Dashboard</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.jsx"></script>
  </body>
</html>
```

- [ ] **Step 3: Create `client/vite.config.js` with backend proxy**

```js
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:3000',
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/tests/setup.js',
  },
});
```

- [ ] **Step 4: Create `client/tailwind.config.js` with cyberpunk theme tokens**

```js
/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        hud: {
          bg: '#06070A',          // near-black
          surface: '#0E121A',     // raised surface
          border: '#1B2230',
          accent: '#00F0FF',      // primary neon cyan
          warn: '#FF2D75',        // magenta warn
          xp: '#FFD60A',          // gold for XP highlight
          success: '#00FF9F',     // mint green for completed
        },
      },
      fontFamily: {
        hud: ['ui-monospace', 'Menlo', 'Monaco', 'Consolas', 'monospace'],
      },
      animation: {
        'scan-line': 'scan-line 2s linear infinite',
        'glitch': 'glitch 0.4s ease-out',
      },
      keyframes: {
        'scan-line': {
          '0%': { transform: 'translateY(-100%)' },
          '100%': { transform: 'translateY(100%)' },
        },
        'glitch': {
          '0%, 100%': { transform: 'translate(0)' },
          '20%': { transform: 'translate(-2px, 2px)' },
          '40%': { transform: 'translate(2px, -2px)' },
          '60%': { transform: 'translate(-1px, -1px)' },
          '80%': { transform: 'translate(1px, 1px)' },
        },
      },
    },
  },
  plugins: [],
};
```

- [ ] **Step 5: Create `client/postcss.config.js`**

```js
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
```

- [ ] **Step 6: Create `client/src/styles/index.css`**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

body {
  @apply bg-hud-bg text-hud-accent font-hud antialiased;
  margin: 0;
}

/* Neon glow utility */
.glow {
  text-shadow: 0 0 6px currentColor, 0 0 12px currentColor;
}
```

- [ ] **Step 7: Create `client/src/main.jsx`**

```jsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './styles/index.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
```

- [ ] **Step 8: Create placeholder `client/src/App.jsx`**

```jsx
export default function App() {
  return (
    <div className="min-h-screen p-8">
      <h1 className="text-4xl font-bold glow">QUEST DASHBOARD</h1>
      <p className="opacity-50">Initializing…</p>
    </div>
  );
}
```

- [ ] **Step 9: Create Vitest setup file**

```bash
mkdir -p client/src/tests
```

Create `client/src/tests/setup.js`:

```js
import '@testing-library/jest-dom';
```

- [ ] **Step 10: Install client dependencies and verify boot**

```bash
npm install --workspace=client
npm run dev --workspace=client
```

Expected: Vite logs `Local: http://localhost:5173/`. Open in browser — should see "QUEST DASHBOARD" heading in cyan glow. Stop with Ctrl+C.

- [ ] **Step 11: Commit**

```bash
git add client/ package-lock.json
git commit -m "chore: scaffold Vite + React + Tailwind client with cyberpunk theme tokens"
```

---

## Phase 1: Backend Core — Quest Model

### Task 1.1: Define Quest model helpers

**Files:**
- Create: `server/core/questModel.js`
- Create: `server/tests/questModel.test.js`

- [ ] **Step 1: Write failing tests**

Create `server/tests/questModel.test.js`:

```js
import { describe, test, expect } from 'vitest';
import {
  createQuest,
  isCompleted,
  hasObjectives,
  computeObjectiveProgress,
} from '../core/questModel.js';

describe('createQuest', () => {
  test('returns a quest with required defaults', () => {
    const q = createQuest({
      id: 'obs:foo:bar:0',
      sourceId: 'obsidian',
      sourceRef: { file: '/foo.md', line: 5 },
      title: 'Hello',
      rawLane: 'Test Lane',
    });
    expect(q.id).toBe('obs:foo:bar:0');
    expect(q.title).toBe('Hello');
    expect(q.completed).toBe(false);
    expect(q.completedAt).toBeNull();
    expect(q.objectives).toEqual([]);
    expect(q.objectiveProgress).toEqual({ done: 0, total: 0 });
    expect(q.flags).toEqual([]);
    expect(q.xp).toBe(0);
    expect(q.xpSource).toBe('auto');
  });
});

describe('isCompleted', () => {
  test('returns true when completed flag set', () => {
    const q = createQuest({ id: 'x', sourceId: 'o', sourceRef: {}, title: 't', rawLane: 'L', completed: true });
    expect(isCompleted(q)).toBe(true);
  });
  test('returns false when not completed', () => {
    const q = createQuest({ id: 'x', sourceId: 'o', sourceRef: {}, title: 't', rawLane: 'L' });
    expect(isCompleted(q)).toBe(false);
  });
});

describe('hasObjectives', () => {
  test('returns false for empty objectives', () => {
    const q = createQuest({ id: 'x', sourceId: 'o', sourceRef: {}, title: 't', rawLane: 'L' });
    expect(hasObjectives(q)).toBe(false);
  });
  test('returns true when objectives present', () => {
    const child = createQuest({ id: 'y', sourceId: 'o', sourceRef: {}, title: 'c', rawLane: 'L' });
    const q = createQuest({ id: 'x', sourceId: 'o', sourceRef: {}, title: 't', rawLane: 'L', objectives: [child] });
    expect(hasObjectives(q)).toBe(true);
  });
});

describe('computeObjectiveProgress', () => {
  test('zero objectives → 0/0', () => {
    const q = createQuest({ id: 'x', sourceId: 'o', sourceRef: {}, title: 't', rawLane: 'L' });
    expect(computeObjectiveProgress(q)).toEqual({ done: 0, total: 0 });
  });
  test('counts completed children only', () => {
    const c1 = createQuest({ id: 'a', sourceId: 'o', sourceRef: {}, title: 'a', rawLane: 'L', completed: true });
    const c2 = createQuest({ id: 'b', sourceId: 'o', sourceRef: {}, title: 'b', rawLane: 'L', completed: false });
    const c3 = createQuest({ id: 'c', sourceId: 'o', sourceRef: {}, title: 'c', rawLane: 'L', completed: true });
    const q = createQuest({ id: 'x', sourceId: 'o', sourceRef: {}, title: 't', rawLane: 'L', objectives: [c1, c2, c3] });
    expect(computeObjectiveProgress(q)).toEqual({ done: 2, total: 3 });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm test --workspace=server
```

Expected: FAIL with "Cannot find module '../core/questModel.js'".

- [ ] **Step 3: Implement `server/core/questModel.js`**

```js
export function createQuest(input) {
  return {
    id: input.id,
    sourceId: input.sourceId,
    sourceRef: input.sourceRef ?? {},
    title: input.title,
    rawTitle: input.rawTitle ?? input.title,
    category: input.category ?? input.rawLane,
    rawLane: input.rawLane,
    xp: input.xp ?? 0,
    xpSource: input.xpSource ?? 'auto',
    flags: input.flags ?? [],
    completed: input.completed ?? false,
    completedAt: input.completedAt ?? null,
    objectives: input.objectives ?? [],
    objectiveProgress: input.objectiveProgress ?? { done: 0, total: 0 },
    deepLink: input.deepLink ?? '',
    notes: input.notes ?? null,
  };
}

export function isCompleted(quest) {
  return quest.completed === true;
}

export function hasObjectives(quest) {
  return Array.isArray(quest.objectives) && quest.objectives.length > 0;
}

export function computeObjectiveProgress(quest) {
  if (!hasObjectives(quest)) return { done: 0, total: 0 };
  const total = quest.objectives.length;
  const done = quest.objectives.filter(isCompleted).length;
  return { done, total };
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm test --workspace=server
```

Expected: 5 passing tests.

- [ ] **Step 5: Commit**

```bash
git add server/core/questModel.js server/tests/questModel.test.js
git commit -m "feat(core): quest model + helpers"
```

---

## Phase 2: Backend Core — Scoring

### Task 2.1: Implement auto base XP from lane

**Files:**
- Create: `server/core/scoring.js`
- Create: `server/tests/scoring.test.js`

- [ ] **Step 1: Write failing tests for base XP**

Create `server/tests/scoring.test.js`:

```js
import { describe, test, expect } from 'vitest';
import { computeXp, deriveFlags, stripXpTag } from '../core/scoring.js';

describe('computeXp — base XP by lane', () => {
  const cases = [
    { lane: 'TO DO - TODAY !', title: 'foo', expected: 30 },
    { lane: '🔥 JOB SEARCH - THIS WEEK', title: 'foo', expected: 25 },
    { lane: '📬 JOB SEARCH - EXAMPLE COMPANY COMPETITORS', title: 'foo', expected: 25 },
    { lane: 'DEV - CLIENT-A 🔺', title: 'foo', expected: 20 },
    { lane: 'DEV - CLIENT-B', title: 'foo', expected: 20 },
    { lane: 'DEV - PERSONAL', title: 'foo', expected: 15 },
    { lane: 'TO DO - BACKBURNER', title: 'foo', expected: 5 },
    { lane: 'Some Other Lane', title: 'foo', expected: 10 },
  ];
  for (const { lane, title, expected } of cases) {
    test(`"${lane}" → ${expected} XP`, () => {
      const { xp, xpSource } = computeXp({ title, rawLane: lane });
      expect(xp).toBe(expected);
      expect(xpSource).toBe('auto');
    });
  }
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm test --workspace=server
```

Expected: FAIL with "Cannot find module '../core/scoring.js'".

- [ ] **Step 3: Implement base XP rules**

Create `server/core/scoring.js`:

```js
const BASE_XP_RULES = [
  { match: (lane) => lane === 'TO DO - TODAY !', xp: 30 },
  { match: (lane) => /JOB SEARCH/i.test(lane), xp: 25 },
  { match: (lane) => lane === 'DEV - CLIENT-A 🔺' || lane === 'DEV - CLIENT-B', xp: 20 },
  { match: (lane) => lane === 'DEV - PERSONAL', xp: 15 },
  { match: (lane) => lane === 'TO DO - BACKBURNER', xp: 5 },
];

const FALLBACK_XP = 10;

const XP_TAG_REGEX = /#xp(\d+)\b/;

export function computeXp({ title, rawLane }) {
  const tagMatch = title.match(XP_TAG_REGEX);
  if (tagMatch) {
    const xp = Math.max(0, parseInt(tagMatch[1], 10));
    return { xp, xpSource: 'tag' };
  }
  const base = baseXpForLane(rawLane);
  const modifierTotal = computeModifiers(title);
  return { xp: base + modifierTotal, xpSource: 'auto' };
}

function baseXpForLane(rawLane) {
  for (const rule of BASE_XP_RULES) {
    if (rule.match(rawLane)) return rule.xp;
  }
  return FALLBACK_XP;
}

function computeModifiers(title) {
  let total = 0;
  if (title.includes('🔥')) total += 10;
  if (title.includes('⭐')) total += 5;
  if (title.includes('🔺')) total += 10;
  if (/\bURGENT\b/i.test(title) || /\bTODAY\b/i.test(title)) total += 5;
  return total;
}

export function deriveFlags(title) {
  const flags = [];
  if (title.includes('🔥')) flags.push('urgent');
  if (title.includes('⭐')) flags.push('starred');
  if (title.includes('🔺')) flags.push('critical');
  return flags;
}

export function stripXpTag(title) {
  return title.replace(XP_TAG_REGEX, '').replace(/\s+/g, ' ').trim();
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm test --workspace=server
```

Expected: 8 passing tests.

- [ ] **Step 5: Commit**

```bash
git add server/core/scoring.js server/tests/scoring.test.js
git commit -m "feat(scoring): base XP rules by lane"
```

---

### Task 2.2: Test modifier stacking

- [ ] **Step 1: Append modifier tests to `server/tests/scoring.test.js`**

```js
describe('computeXp — modifiers stack additively', () => {
  test('🔥 adds +10', () => {
    expect(computeXp({ title: '🔥 Foo', rawLane: 'DEV - PERSONAL' }).xp).toBe(25);
  });
  test('⭐ adds +5', () => {
    expect(computeXp({ title: '⭐ Foo', rawLane: 'DEV - PERSONAL' }).xp).toBe(20);
  });
  test('🔺 adds +10', () => {
    expect(computeXp({ title: '🔺 Foo', rawLane: 'DEV - PERSONAL' }).xp).toBe(25);
  });
  test('URGENT adds +5', () => {
    expect(computeXp({ title: 'URGENT Foo', rawLane: 'DEV - PERSONAL' }).xp).toBe(20);
  });
  test('TODAY adds +5', () => {
    expect(computeXp({ title: 'TODAY Foo', rawLane: 'DEV - PERSONAL' }).xp).toBe(20);
  });
  test('multiple modifiers stack', () => {
    // base 25 (JOB SEARCH) + 10 (🔥) + 5 (⭐) + 5 (URGENT) = 45
    const { xp } = computeXp({
      title: '🔥 ⭐ URGENT Apply to Vercel',
      rawLane: '🚀 JOB SEARCH - SAAS COMPANIES',
    });
    expect(xp).toBe(45);
  });
});
```

- [ ] **Step 2: Run tests**

```bash
npm test --workspace=server
```

Expected: All previous tests + 6 new modifier tests pass.

- [ ] **Step 3: Commit**

```bash
git add server/tests/scoring.test.js
git commit -m "test(scoring): modifier stacking coverage"
```

---

### Task 2.3: Test hashtag XP override

- [ ] **Step 1: Append override tests to `server/tests/scoring.test.js`**

```js
describe('computeXp — #xpN override', () => {
  test('#xp25 overrides auto rules', () => {
    const { xp, xpSource } = computeXp({
      title: 'Foo #xp25',
      rawLane: 'TO DO - BACKBURNER',
    });
    expect(xp).toBe(25);
    expect(xpSource).toBe('tag');
  });
  test('#xp tag prevents modifier stacking', () => {
    const { xp } = computeXp({
      title: '🔥 ⭐ Foo #xp10',
      rawLane: '🚀 JOB SEARCH',
    });
    expect(xp).toBe(10);
  });
  test('xp can be 0', () => {
    expect(computeXp({ title: 'Ignore #xp0', rawLane: 'X' }).xp).toBe(0);
  });
});

describe('deriveFlags', () => {
  test('extracts all flags', () => {
    expect(deriveFlags('🔥 ⭐ 🔺 Foo')).toEqual(['urgent', 'starred', 'critical']);
  });
  test('returns empty array for plain title', () => {
    expect(deriveFlags('plain text')).toEqual([]);
  });
});

describe('stripXpTag', () => {
  test('removes #xpN tag from title', () => {
    expect(stripXpTag('Apply to Vercel #xp25')).toBe('Apply to Vercel');
  });
  test('returns title unchanged when no tag', () => {
    expect(stripXpTag('Apply to Vercel')).toBe('Apply to Vercel');
  });
  test('collapses extra whitespace from removal', () => {
    expect(stripXpTag('Apply #xp25 to Vercel')).toBe('Apply to Vercel');
  });
});
```

- [ ] **Step 2: Run tests**

```bash
npm test --workspace=server
```

Expected: All scoring tests pass (16+ total).

- [ ] **Step 3: Commit**

```bash
git add server/tests/scoring.test.js
git commit -m "test(scoring): #xpN override + flags + tag stripping"
```

---

## Phase 3: Backend Core — Category Mapping

### Task 3.1: Implement default category rules

**Files:**
- Create: `server/core/categoryMap.js`
- Create: `server/tests/categoryMap.test.js`

- [ ] **Step 1: Write failing tests**

Create `server/tests/categoryMap.test.js`:

```js
import { describe, test, expect } from 'vitest';
import { mapCategory, DEFAULT_RULES, applyRules } from '../core/categoryMap.js';

describe('mapCategory — default rules', () => {
  const cases = [
    { lane: 'TO DO - TODAY !', expected: { category: 'Daily Quests', featured: true, hidden: false } },
    { lane: '🔥 JOB SEARCH - THIS WEEK', expected: { category: 'Job Hunt', featured: false, hidden: false } },
    { lane: '📬 JOB SEARCH - EXAMPLE COMPANY COMPETITORS', expected: { category: 'Job Hunt', featured: false, hidden: false } },
    { lane: 'DEV - PERSONAL', expected: { category: 'Personal Dev', featured: false, hidden: false } },
    { lane: 'DEV - CLIENT-B', expected: { category: 'Project B', featured: false, hidden: false } },
    { lane: 'DEV - CLIENT-A 🔺', expected: { category: 'Project A', featured: false, hidden: false } },
    { lane: 'TO DO - BACKBURNER', expected: { category: 'Side Quests', featured: false, hidden: false } },
    { lane: 'DONE - REVIEW', expected: { hidden: true } },
    { lane: 'Archive', expected: { hidden: true } },
    { lane: 'Custom Lane Name', expected: { category: 'Custom Lane Name', featured: false, hidden: false } },
  ];
  for (const { lane, expected } of cases) {
    test(`"${lane}" → ${JSON.stringify(expected)}`, () => {
      const result = mapCategory(lane);
      if (expected.hidden) {
        expect(result.hidden).toBe(true);
      } else {
        expect(result).toMatchObject(expected);
      }
    });
  }
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm test --workspace=server
```

Expected: FAIL with module not found.

- [ ] **Step 3: Implement `server/core/categoryMap.js`**

```js
export const DEFAULT_RULES = [
  { test: (lane) => lane === 'TO DO - TODAY !', map: () => ({ category: 'Daily Quests', featured: true }) },
  { test: (lane) => /JOB SEARCH/i.test(lane), map: () => ({ category: 'Job Hunt' }) },
  { test: (lane) => /^DEV - (.+)/.test(lane), map: (lane) => {
      const suffix = lane.match(/^DEV - (.+)/)[1].replace(/🔺/g, '').trim();
      const name = suffix === 'PERSONAL' ? 'Personal Dev' :
                   suffix === 'CLIENT-B' ? 'Project B' :
                   suffix === 'CLIENT-A' ? 'Project A' :
                   suffix;
      return { category: name };
    }
  },
  { test: (lane) => lane === 'TO DO - BACKBURNER', map: () => ({ category: 'Side Quests' }) },
  { test: (lane) => lane === 'DONE - REVIEW' || lane === 'Archive', map: () => ({ hidden: true }) },
];

export function applyRules(lane, rules = DEFAULT_RULES) {
  for (const rule of rules) {
    if (rule.test(lane)) {
      const result = rule.map(lane);
      return {
        category: result.category ?? lane,
        featured: result.featured ?? false,
        hidden: result.hidden ?? false,
      };
    }
  }
  return { category: lane, featured: false, hidden: false };
}

export function mapCategory(lane) {
  return applyRules(lane);
}
```

- [ ] **Step 4: Run tests**

```bash
npm test --workspace=server
```

Expected: 10 passing tests.

- [ ] **Step 5: Commit**

```bash
git add server/core/categoryMap.js server/tests/categoryMap.test.js
git commit -m "feat(core): category mapping rules"
```

---

## Phase 4: Backend Core — History Store

### Task 4.1: Implement append + read of XP history

**Files:**
- Create: `server/core/historyStore.js`
- Create: `server/tests/historyStore.test.js`

- [ ] **Step 1: Write failing tests**

Create `server/tests/historyStore.test.js`:

```js
import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';
import { createHistoryStore } from '../core/historyStore.js';

let tmpDir;
let storePath;

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'qd-test-'));
  storePath = path.join(tmpDir, 'history.jsonl');
});

afterEach(async () => {
  await fs.rm(tmpDir, { recursive: true, force: true });
});

describe('historyStore — append + read', () => {
  test('appendEvent persists a single line', async () => {
    const store = createHistoryStore(storePath);
    await store.appendEvent({ questId: 'q1', xp: 25, ts: '2026-05-18T10:00:00Z', source: 'obsidian', title: 'Foo' });
    const raw = await fs.readFile(storePath, 'utf8');
    const lines = raw.trim().split('\n');
    expect(lines).toHaveLength(1);
    expect(JSON.parse(lines[0])).toMatchObject({ questId: 'q1', xp: 25 });
  });

  test('readAll returns all appended events in order', async () => {
    const store = createHistoryStore(storePath);
    await store.appendEvent({ questId: 'q1', xp: 10, ts: '2026-05-18T10:00:00Z', source: 'o', title: 't1' });
    await store.appendEvent({ questId: 'q2', xp: 20, ts: '2026-05-18T11:00:00Z', source: 'o', title: 't2' });
    const events = await store.readAll();
    expect(events).toHaveLength(2);
    expect(events[0].questId).toBe('q1');
    expect(events[1].questId).toBe('q2');
  });

  test('readAll returns empty array when file does not exist', async () => {
    const store = createHistoryStore(storePath);
    expect(await store.readAll()).toEqual([]);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm test --workspace=server
```

Expected: FAIL.

- [ ] **Step 3: Implement `server/core/historyStore.js`**

```js
import { promises as fs } from 'fs';
import path from 'path';

export function createHistoryStore(filePath) {
  return {
    async appendEvent(event) {
      await fs.mkdir(path.dirname(filePath), { recursive: true });
      const line = JSON.stringify(event) + '\n';
      await fs.appendFile(filePath, line);
    },

    async appendBatch(events) {
      if (events.length === 0) return;
      await fs.mkdir(path.dirname(filePath), { recursive: true });
      const block = events.map(e => JSON.stringify(e)).join('\n') + '\n';
      await fs.appendFile(filePath, block);
    },

    async readAll() {
      try {
        const raw = await fs.readFile(filePath, 'utf8');
        return raw
          .trim()
          .split('\n')
          .filter(l => l.length > 0)
          .map(l => JSON.parse(l));
      } catch (err) {
        if (err.code === 'ENOENT') return [];
        throw err;
      }
    },
  };
}
```

- [ ] **Step 4: Run tests**

```bash
npm test --workspace=server
```

Expected: 3 passing tests.

- [ ] **Step 5: Commit**

```bash
git add server/core/historyStore.js server/tests/historyStore.test.js
git commit -m "feat(core): historyStore append + read JSONL"
```

---

### Task 4.2: Implement date-window aggregation + dedupe + streak

- [ ] **Step 1: Append tests for aggregation, dedupe, and streak**

Add to `server/tests/historyStore.test.js`:

```js
describe('historyStore — aggregations', () => {
  test('sumXpInWindow filters by date range', async () => {
    const store = createHistoryStore(storePath);
    await store.appendBatch([
      { questId: 'a', xp: 10, ts: '2026-05-18T10:00:00Z', source: 'o', title: 'a' },
      { questId: 'b', xp: 20, ts: '2026-05-17T10:00:00Z', source: 'o', title: 'b' },
      { questId: 'c', xp: 30, ts: '2026-05-18T15:00:00Z', source: 'o', title: 'c' },
    ]);
    const total = await store.sumXpInWindow(
      new Date('2026-05-18T00:00:00Z'),
      new Date('2026-05-18T23:59:59Z')
    );
    expect(total).toBe(40);
  });

  test('rollingAverage computes per-day mean over N days', async () => {
    const store = createHistoryStore(storePath);
    await store.appendBatch([
      { questId: '1', xp: 50, ts: '2026-05-11T10:00:00Z', source: 'o', title: 'a' },
      { questId: '2', xp: 60, ts: '2026-05-12T10:00:00Z', source: 'o', title: 'b' },
      { questId: '3', xp: 40, ts: '2026-05-13T10:00:00Z', source: 'o', title: 'c' },
    ]);
    const avg = await store.rollingDailyAverage(new Date('2026-05-13T23:59:59Z'), 7);
    // 3 events totaling 150 over 7-day window → avg 150/7 ≈ 21.43
    expect(avg).toBeCloseTo(150 / 7, 1);
  });

  test('isDuplicate detects same questId on same date', async () => {
    const store = createHistoryStore(storePath);
    await store.appendEvent({ questId: 'q1', xp: 10, ts: '2026-05-18T10:00:00Z', source: 'o', title: 't' });
    expect(await store.isDuplicate('q1', new Date('2026-05-18T15:00:00Z'))).toBe(true);
    expect(await store.isDuplicate('q1', new Date('2026-05-19T10:00:00Z'))).toBe(false);
    expect(await store.isDuplicate('q2', new Date('2026-05-18T10:00:00Z'))).toBe(false);
  });

  test('streakDays counts consecutive days ending at given date with xp > 0', async () => {
    const store = createHistoryStore(storePath);
    await store.appendBatch([
      { questId: '1', xp: 10, ts: '2026-05-16T10:00:00Z', source: 'o', title: 'a' },
      { questId: '2', xp: 20, ts: '2026-05-17T10:00:00Z', source: 'o', title: 'b' },
      { questId: '3', xp: 30, ts: '2026-05-18T10:00:00Z', source: 'o', title: 'c' },
    ]);
    expect(await store.streakDays(new Date('2026-05-18T23:00:00Z'))).toBe(3);
  });

  test('streakDays breaks on zero day', async () => {
    const store = createHistoryStore(storePath);
    await store.appendBatch([
      { questId: '1', xp: 10, ts: '2026-05-16T10:00:00Z', source: 'o', title: 'a' },
      // skip 2026-05-17
      { questId: '3', xp: 30, ts: '2026-05-18T10:00:00Z', source: 'o', title: 'c' },
    ]);
    expect(await store.streakDays(new Date('2026-05-18T23:00:00Z'))).toBe(1);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm test --workspace=server
```

Expected: FAIL — these methods don't exist yet.

- [ ] **Step 3: Add aggregation methods to `server/core/historyStore.js`**

Replace `createHistoryStore` with the extended version:

```js
import { promises as fs } from 'fs';
import path from 'path';

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

export function createHistoryStore(filePath) {
  const api = {
    async appendEvent(event) {
      await fs.mkdir(path.dirname(filePath), { recursive: true });
      const line = JSON.stringify(event) + '\n';
      await fs.appendFile(filePath, line);
    },

    async appendBatch(events) {
      if (events.length === 0) return;
      await fs.mkdir(path.dirname(filePath), { recursive: true });
      const block = events.map(e => JSON.stringify(e)).join('\n') + '\n';
      await fs.appendFile(filePath, block);
    },

    async readAll() {
      try {
        const raw = await fs.readFile(filePath, 'utf8');
        return raw
          .trim()
          .split('\n')
          .filter(l => l.length > 0)
          .map(l => JSON.parse(l));
      } catch (err) {
        if (err.code === 'ENOENT') return [];
        throw err;
      }
    },

    async sumXpInWindow(startDate, endDate) {
      const events = await api.readAll();
      return events
        .filter(e => {
          const ts = new Date(e.ts).getTime();
          return ts >= startDate.getTime() && ts <= endDate.getTime();
        })
        .reduce((sum, e) => sum + (e.xp || 0), 0);
    },

    async rollingDailyAverage(endDate, days = 7) {
      const start = new Date(endDate.getTime() - (days - 1) * ONE_DAY_MS);
      const total = await api.sumXpInWindow(start, endDate);
      return total / days;
    },

    async isDuplicate(questId, ts) {
      const targetDate = isoDate(ts);
      const events = await api.readAll();
      return events.some(e => e.questId === questId && isoDate(new Date(e.ts)) === targetDate);
    },

    async streakDays(endDate) {
      const events = await api.readAll();
      const xpByDate = new Map();
      for (const e of events) {
        const d = isoDate(new Date(e.ts));
        xpByDate.set(d, (xpByDate.get(d) || 0) + (e.xp || 0));
      }
      let streak = 0;
      let cursor = new Date(endDate);
      while (true) {
        const key = isoDate(cursor);
        if ((xpByDate.get(key) || 0) > 0) {
          streak += 1;
          cursor = new Date(cursor.getTime() - ONE_DAY_MS);
        } else {
          break;
        }
      }
      return streak;
    },
  };
  return api;
}

function isoDate(date) {
  return date.toISOString().slice(0, 10);
}
```

- [ ] **Step 4: Run tests**

```bash
npm test --workspace=server
```

Expected: 8 passing tests total in historyStore.

- [ ] **Step 5: Commit**

```bash
git add server/core/historyStore.js server/tests/historyStore.test.js
git commit -m "feat(core): historyStore date-window sum, rolling avg, dedupe, streak"
```

---

## Phase 5: Backend Core — Lock Manager

### Task 5.1: Implement advisory file lock

**Files:**
- Create: `server/core/lockManager.js`
- Create: `server/tests/lockManager.test.js`

- [ ] **Step 1: Write failing tests**

Create `server/tests/lockManager.test.js`:

```js
import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';
import { createLockManager } from '../core/lockManager.js';

let tmpDir;
let targetFile;

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'qd-lock-'));
  targetFile = path.join(tmpDir, 'target.md');
  await fs.writeFile(targetFile, 'content');
});

afterEach(async () => {
  await fs.rm(tmpDir, { recursive: true, force: true });
});

describe('lockManager', () => {
  test('acquire creates a .lock file beside the target', async () => {
    const lock = createLockManager();
    await lock.acquire(targetFile);
    const lockPath = path.join(tmpDir, '.target.md.lock');
    const stat = await fs.stat(lockPath);
    expect(stat.isFile()).toBe(true);
    await lock.release(targetFile);
  });

  test('release removes the .lock file', async () => {
    const lock = createLockManager();
    await lock.acquire(targetFile);
    await lock.release(targetFile);
    const lockPath = path.join(tmpDir, '.target.md.lock');
    await expect(fs.stat(lockPath)).rejects.toMatchObject({ code: 'ENOENT' });
  });

  test('acquire on already-locked file throws LockBusyError', async () => {
    const lock = createLockManager();
    await lock.acquire(targetFile);
    await expect(lock.acquire(targetFile, { retries: 0 })).rejects.toThrow('LOCK_BUSY');
    await lock.release(targetFile);
  });

  test('stale lock (older than maxAgeMs) is forcibly acquired', async () => {
    const lock = createLockManager();
    const lockPath = path.join(tmpDir, '.target.md.lock');
    const stalePayload = JSON.stringify({ pid: 99999, acquiredAt: new Date(Date.now() - 10_000).toISOString() });
    await fs.writeFile(lockPath, stalePayload);
    await lock.acquire(targetFile, { maxAgeMs: 5000 });
    await lock.release(targetFile);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm test --workspace=server
```

Expected: FAIL.

- [ ] **Step 3: Implement `server/core/lockManager.js`**

```js
import { promises as fs } from 'fs';
import path from 'path';

const DEFAULT_MAX_AGE_MS = 5000;
const DEFAULT_RETRY_MS = 100;

export function createLockManager() {
  return {
    async acquire(targetFile, opts = {}) {
      const maxAgeMs = opts.maxAgeMs ?? DEFAULT_MAX_AGE_MS;
      const retries = opts.retries ?? 1;
      const lockPath = lockPathFor(targetFile);

      for (let attempt = 0; attempt <= retries; attempt++) {
        try {
          const payload = JSON.stringify({ pid: process.pid, acquiredAt: new Date().toISOString() });
          await fs.writeFile(lockPath, payload, { flag: 'wx' });
          return;
        } catch (err) {
          if (err.code !== 'EEXIST') throw err;
          // Lock exists — check if stale
          const isStale = await checkStale(lockPath, maxAgeMs);
          if (isStale) {
            await fs.unlink(lockPath).catch(() => {});
            continue;
          }
          if (attempt === retries) {
            const lockErr = new Error('LOCK_BUSY');
            lockErr.code = 'LOCK_BUSY';
            throw lockErr;
          }
          await sleep(DEFAULT_RETRY_MS);
        }
      }
    },

    async release(targetFile) {
      const lockPath = lockPathFor(targetFile);
      await fs.unlink(lockPath).catch((err) => {
        if (err.code !== 'ENOENT') throw err;
      });
    },
  };
}

function lockPathFor(targetFile) {
  const dir = path.dirname(targetFile);
  const base = path.basename(targetFile);
  return path.join(dir, `.${base}.lock`);
}

async function checkStale(lockPath, maxAgeMs) {
  try {
    const raw = await fs.readFile(lockPath, 'utf8');
    const { acquiredAt } = JSON.parse(raw);
    const age = Date.now() - new Date(acquiredAt).getTime();
    return age > maxAgeMs;
  } catch {
    return true;
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
```

- [ ] **Step 4: Run tests**

```bash
npm test --workspace=server
```

Expected: 4 passing tests.

- [ ] **Step 5: Commit**

```bash
git add server/core/lockManager.js server/tests/lockManager.test.js
git commit -m "feat(core): advisory file lockManager with stale detection"
```

---

## Phase 6: Backend Parsers — Kanban Markdown

### Task 6.1: Parse lanes and top-level tasks

**Files:**
- Create: `server/parsers/kanbanMarkdown.js`
- Create: `server/tests/kanbanMarkdown.test.js`
- Create: `server/tests/fixtures/sample-board.md`

- [ ] **Step 1: Create fixture file**

Create `server/tests/fixtures/sample-board.md`:

```markdown
---

kanban-plugin: board

---

## TO DO - TODAY !

- [ ] First today task
- [ ] 🔥 Second today task

## DEV - PERSONAL

- [ ] Personal task
	- [ ] Subtask one
	- [x] Subtask two
- [x] Completed task ✅ 2026-05-15

## Archive

- [x] Old thing ✅ 2026-01-01

%% kanban:settings
```
{"kanban-plugin":"board"}
```
%%
```

- [ ] **Step 2: Write failing tests**

Create `server/tests/kanbanMarkdown.test.js`:

```js
import { describe, test, expect } from 'vitest';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { parseBoard } from '../parsers/kanbanMarkdown.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const FIXTURE = path.join(__dirname, 'fixtures', 'sample-board.md');

describe('parseBoard', () => {
  test('extracts three lanes from fixture', async () => {
    const raw = await fs.readFile(FIXTURE, 'utf8');
    const board = parseBoard(raw);
    expect(board.lanes.map(l => l.name)).toEqual([
      'TO DO - TODAY !',
      'DEV - PERSONAL',
      'Archive',
    ]);
  });

  test('captures top-level tasks per lane', async () => {
    const raw = await fs.readFile(FIXTURE, 'utf8');
    const board = parseBoard(raw);
    const today = board.lanes.find(l => l.name === 'TO DO - TODAY !');
    expect(today.tasks).toHaveLength(2);
    expect(today.tasks[0].title).toBe('First today task');
    expect(today.tasks[0].completed).toBe(false);
    expect(today.tasks[1].title).toBe('🔥 Second today task');
  });

  test('records line numbers for each task', async () => {
    const raw = await fs.readFile(FIXTURE, 'utf8');
    const board = parseBoard(raw);
    const today = board.lanes.find(l => l.name === 'TO DO - TODAY !');
    expect(today.tasks[0].line).toBeTypeOf('number');
    expect(today.tasks[0].line).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

```bash
npm test --workspace=server
```

Expected: FAIL.

- [ ] **Step 4: Implement initial parser**

Create `server/parsers/kanbanMarkdown.js`:

```js
const LANE_HEADER_RE = /^##\s+(.+)$/;
const TASK_LINE_RE = /^(\s*)-\s+\[( |x)\]\s+(.+)$/;
const COMPLETION_DATE_RE = /✅\s*(\d{4}-\d{2}-\d{2})/;
const SETTINGS_BLOCK_RE = /^%%\s*kanban:settings/;

export function parseBoard(raw) {
  const lines = raw.split('\n');
  const lanes = [];
  let currentLane = null;
  let inSettings = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (SETTINGS_BLOCK_RE.test(line)) {
      inSettings = true;
      continue;
    }
    if (inSettings) continue;

    const laneMatch = line.match(LANE_HEADER_RE);
    if (laneMatch) {
      currentLane = { name: laneMatch[1].trim(), tasks: [] };
      lanes.push(currentLane);
      continue;
    }

    if (!currentLane) continue;

    const taskMatch = line.match(TASK_LINE_RE);
    if (taskMatch) {
      const [, indent, mark, body] = taskMatch;
      // For task #6.1 we only handle top-level (no indentation)
      if (indent.length > 0) continue;
      const completed = mark === 'x';
      const dateMatch = body.match(COMPLETION_DATE_RE);
      currentLane.tasks.push({
        title: body.replace(COMPLETION_DATE_RE, '').trim(),
        rawTitle: body,
        completed,
        completedAt: dateMatch ? `${dateMatch[1]}T00:00:00Z` : null,
        line: i,
        objectives: [],
      });
    }
  }

  return { lanes };
}
```

- [ ] **Step 5: Run tests**

```bash
npm test --workspace=server
```

Expected: 3 passing tests.

- [ ] **Step 6: Commit**

```bash
git add server/parsers/kanbanMarkdown.js server/tests/kanbanMarkdown.test.js server/tests/fixtures/sample-board.md
git commit -m "feat(parser): parseBoard extracts lanes + top-level tasks"
```

---

### Task 6.2: Parse nested subtasks

- [ ] **Step 1: Append subtask tests**

Add to `server/tests/kanbanMarkdown.test.js`:

```js
describe('parseBoard — subtasks', () => {
  test('nests subtasks under parent task', async () => {
    const raw = await fs.readFile(FIXTURE, 'utf8');
    const board = parseBoard(raw);
    const dev = board.lanes.find(l => l.name === 'DEV - PERSONAL');
    const parent = dev.tasks.find(t => t.title === 'Personal task');
    expect(parent.objectives).toHaveLength(2);
    expect(parent.objectives[0].title).toBe('Subtask one');
    expect(parent.objectives[0].completed).toBe(false);
    expect(parent.objectives[1].title).toBe('Subtask two');
    expect(parent.objectives[1].completed).toBe(true);
  });

  test('captures completion date on completed top-level task', async () => {
    const raw = await fs.readFile(FIXTURE, 'utf8');
    const board = parseBoard(raw);
    const dev = board.lanes.find(l => l.name === 'DEV - PERSONAL');
    const done = dev.tasks.find(t => t.title === 'Completed task');
    expect(done.completed).toBe(true);
    expect(done.completedAt).toBe('2026-05-15T00:00:00Z');
  });
});
```

- [ ] **Step 2: Run tests to verify the subtask one fails (date test should already pass)**

```bash
npm test --workspace=server
```

Expected: subtask nesting test FAILS; date test passes.

- [ ] **Step 3: Extend parser to handle subtasks**

Replace `parseBoard` body inside `server/parsers/kanbanMarkdown.js`:

```js
export function parseBoard(raw) {
  const lines = raw.split('\n');
  const lanes = [];
  let currentLane = null;
  let lastTopLevelTask = null;
  let inSettings = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (SETTINGS_BLOCK_RE.test(line)) {
      inSettings = true;
      continue;
    }
    if (inSettings) continue;

    const laneMatch = line.match(LANE_HEADER_RE);
    if (laneMatch) {
      currentLane = { name: laneMatch[1].trim(), tasks: [] };
      lastTopLevelTask = null;
      lanes.push(currentLane);
      continue;
    }

    if (!currentLane) continue;

    const taskMatch = line.match(TASK_LINE_RE);
    if (!taskMatch) continue;

    const [, indent, mark, body] = taskMatch;
    const completed = mark === 'x';
    const dateMatch = body.match(COMPLETION_DATE_RE);
    const task = {
      title: body.replace(COMPLETION_DATE_RE, '').trim(),
      rawTitle: body,
      completed,
      completedAt: dateMatch ? `${dateMatch[1]}T00:00:00Z` : null,
      line: i,
      objectives: [],
    };

    if (indent.length === 0) {
      currentLane.tasks.push(task);
      lastTopLevelTask = task;
    } else if (lastTopLevelTask) {
      // Nest under most recent top-level
      lastTopLevelTask.objectives.push(task);
    }
  }

  return { lanes };
}
```

- [ ] **Step 4: Run tests**

```bash
npm test --workspace=server
```

Expected: All parser tests pass (5 total).

- [ ] **Step 5: Commit**

```bash
git add server/parsers/kanbanMarkdown.js server/tests/kanbanMarkdown.test.js
git commit -m "feat(parser): nest subtasks under parent task"
```

---

### Task 6.3: Write back — markLineComplete

- [ ] **Step 1: Write tests**

Add to `server/tests/kanbanMarkdown.test.js`:

```js
import { markLineComplete, titleMatches } from '../parsers/kanbanMarkdown.js';

describe('markLineComplete', () => {
  test('converts - [ ] to - [x] and appends date', () => {
    const line = '- [ ] Apply to Vercel';
    const updated = markLineComplete(line, '2026-05-18');
    expect(updated).toBe('- [x] Apply to Vercel ✅ 2026-05-18');
  });

  test('preserves leading indentation', () => {
    const line = '\t- [ ] Subtask';
    const updated = markLineComplete(line, '2026-05-18');
    expect(updated).toBe('\t- [x] Subtask ✅ 2026-05-18');
  });

  test('throws on already completed', () => {
    expect(() => markLineComplete('- [x] Done', '2026-05-18')).toThrow('ALREADY_COMPLETE');
  });

  test('throws on non-task line', () => {
    expect(() => markLineComplete('not a task', '2026-05-18')).toThrow('NOT_A_TASK');
  });
});

describe('titleMatches', () => {
  test('matches when line title equals expected', () => {
    expect(titleMatches('- [ ] Apply to Vercel', 'Apply to Vercel')).toBe(true);
  });
  test('does not match different title', () => {
    expect(titleMatches('- [ ] Apply to Vercel', 'Apply to Netlify')).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm test --workspace=server
```

Expected: FAIL — functions not exported.

- [ ] **Step 3: Add `markLineComplete` and `titleMatches` exports to `server/parsers/kanbanMarkdown.js`**

Append:

```js
export function markLineComplete(line, dateStr) {
  const match = line.match(TASK_LINE_RE);
  if (!match) {
    const err = new Error('NOT_A_TASK');
    err.code = 'NOT_A_TASK';
    throw err;
  }
  const [, indent, mark, body] = match;
  if (mark === 'x') {
    const err = new Error('ALREADY_COMPLETE');
    err.code = 'ALREADY_COMPLETE';
    throw err;
  }
  const cleanBody = body.replace(COMPLETION_DATE_RE, '').trim();
  return `${indent}- [x] ${cleanBody} ✅ ${dateStr}`;
}

export function titleMatches(line, expectedTitle) {
  const match = line.match(TASK_LINE_RE);
  if (!match) return false;
  const body = match[3].replace(COMPLETION_DATE_RE, '').trim();
  return body === expectedTitle;
}
```

- [ ] **Step 4: Run tests**

```bash
npm test --workspace=server
```

Expected: All parser tests pass.

- [ ] **Step 5: Commit**

```bash
git add server/parsers/kanbanMarkdown.js server/tests/kanbanMarkdown.test.js
git commit -m "feat(parser): markLineComplete + titleMatches for write-back"
```

---

## Phase 7: Backend — SyncAdapter Interface

### Task 7.1: Define abstract SyncAdapter

**Files:**
- Create: `server/adapters/SyncAdapter.js`

- [ ] **Step 1: Implement interface (no tests — pure contract)**

Create `server/adapters/SyncAdapter.js`:

```js
export class SyncAdapter {
  getId() {
    throw new Error('SyncAdapter.getId() not implemented');
  }

  async listQuests() {
    throw new Error('SyncAdapter.listQuests() not implemented');
  }

  async markComplete(_sourceRef) {
    throw new Error('SyncAdapter.markComplete() not implemented');
  }

  async healthCheck() {
    throw new Error('SyncAdapter.healthCheck() not implemented');
  }
}

export class ConflictError extends Error {
  constructor(message = 'quest_changed') {
    super(message);
    this.code = 'CONFLICT';
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add server/adapters/SyncAdapter.js
git commit -m "feat(adapters): SyncAdapter interface + ConflictError"
```

---

## Phase 8: Backend — ObsidianAdapter

### Task 8.1: Implement listQuests

**Files:**
- Create: `server/adapters/ObsidianAdapter.js`
- Create: `server/tests/ObsidianAdapter.test.js`

- [ ] **Step 1: Write failing test**

Create `server/tests/ObsidianAdapter.test.js`:

```js
import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';
import { ObsidianAdapter } from '../adapters/ObsidianAdapter.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const FIXTURE = path.join(__dirname, 'fixtures', 'sample-board.md');

let tmpDir;
let workingFile;

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'qd-obs-'));
  workingFile = path.join(tmpDir, 'board.md');
  const raw = await fs.readFile(FIXTURE, 'utf8');
  await fs.writeFile(workingFile, raw);
});

afterEach(async () => {
  await fs.rm(tmpDir, { recursive: true, force: true });
});

describe('ObsidianAdapter — listQuests', () => {
  test('returns quests for visible lanes only', async () => {
    const adapter = new ObsidianAdapter({ file: workingFile, vault: 'TestVault' });
    const quests = await adapter.listQuests();
    // Today (2) + Dev (2) — Archive lane is hidden by mapper at aggregator level,
    // but adapter returns all; aggregator filters hidden later. So expect 5 raw quests.
    expect(quests.length).toBe(5);
  });

  test('quest IDs are stable and source-prefixed', async () => {
    const adapter = new ObsidianAdapter({ file: workingFile, vault: 'TestVault' });
    const quests = await adapter.listQuests();
    for (const q of quests) {
      expect(q.id.startsWith('obsidian:')).toBe(true);
    }
    // IDs unique
    const ids = quests.map(q => q.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  test('quest carries deepLink to obsidian://', async () => {
    const adapter = new ObsidianAdapter({ file: workingFile, vault: 'TestVault' });
    const quests = await adapter.listQuests();
    expect(quests[0].deepLink).toContain('obsidian://');
    expect(quests[0].deepLink).toContain('TestVault');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm test --workspace=server
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement `server/adapters/ObsidianAdapter.js`**

```js
import { promises as fs } from 'fs';
import path from 'path';
import { SyncAdapter, ConflictError } from './SyncAdapter.js';
import { parseBoard, markLineComplete, titleMatches } from '../parsers/kanbanMarkdown.js';
import { createLockManager } from '../core/lockManager.js';
import { createQuest, computeObjectiveProgress } from '../core/questModel.js';

export class ObsidianAdapter extends SyncAdapter {
  constructor({ file, vault }) {
    super();
    this.file = file;
    this.vault = vault;
    this.lockManager = createLockManager();
  }

  getId() {
    return 'obsidian';
  }

  async listQuests() {
    const raw = await fs.readFile(this.file, 'utf8');
    const board = parseBoard(raw);
    const quests = [];

    for (const lane of board.lanes) {
      const laneSlug = slugify(lane.name);
      lane.tasks.forEach((task, idx) => {
        const quest = this._buildQuest(task, lane, laneSlug, idx);
        quests.push(quest);
      });
    }

    return quests;
  }

  _buildQuest(task, lane, laneSlug, idx) {
    const fileSlug = slugify(path.basename(this.file, '.md'));
    const id = `obsidian:${fileSlug}:${laneSlug}:${idx}`;
    const objectives = (task.objectives || []).map((obj, oIdx) => createQuest({
      id: `${id}:obj:${oIdx}`,
      sourceId: 'obsidian',
      sourceRef: { file: this.file, line: obj.line, parentLine: task.line },
      title: obj.title,
      rawLane: lane.name,
      completed: obj.completed,
      completedAt: obj.completedAt,
    }));

    const quest = createQuest({
      id,
      sourceId: 'obsidian',
      sourceRef: { file: this.file, line: task.line, parentLine: null, expectedTitle: task.title },
      title: task.title,
      rawTitle: task.rawTitle,
      rawLane: lane.name,
      completed: task.completed,
      completedAt: task.completedAt,
      objectives,
      deepLink: this._buildDeepLink(),
    });
    quest.objectiveProgress = computeObjectiveProgress(quest);
    return quest;
  }

  _buildDeepLink() {
    const params = new URLSearchParams({ vault: this.vault, file: path.basename(this.file, '.md') });
    return `obsidian://open?${params.toString()}`;
  }

  async markComplete(sourceRef) {
    await this.lockManager.acquire(this.file);
    try {
      const raw = await fs.readFile(this.file, 'utf8');
      const lines = raw.split('\n');
      const line = lines[sourceRef.line];
      if (!line) throw new ConflictError('line_missing');
      if (!titleMatches(line, sourceRef.expectedTitle)) {
        throw new ConflictError('title_mismatch');
      }
      const today = new Date().toISOString().slice(0, 10);
      lines[sourceRef.line] = markLineComplete(line, today);
      await fs.writeFile(this.file, lines.join('\n'));
    } finally {
      await this.lockManager.release(this.file);
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

function slugify(text) {
  return text
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-');
}
```

- [ ] **Step 4: Run tests**

```bash
npm test --workspace=server
```

Expected: 3 passing tests in ObsidianAdapter.

- [ ] **Step 5: Commit**

```bash
git add server/adapters/ObsidianAdapter.js server/tests/ObsidianAdapter.test.js
git commit -m "feat(adapters): ObsidianAdapter.listQuests with stable IDs + deep links"
```

---

### Task 8.2: Test markComplete write-back

- [ ] **Step 1: Add tests for markComplete**

Append to `server/tests/ObsidianAdapter.test.js`:

```js
describe('ObsidianAdapter — markComplete', () => {
  test('rewrites - [ ] to - [x] with today date', async () => {
    const adapter = new ObsidianAdapter({ file: workingFile, vault: 'TestVault' });
    const quests = await adapter.listQuests();
    const target = quests.find(q => q.title === 'First today task');
    await adapter.markComplete(target.sourceRef);
    const updated = await fs.readFile(workingFile, 'utf8');
    expect(updated).toContain('- [x] First today task ✅');
  });

  test('throws ConflictError when line title no longer matches', async () => {
    const adapter = new ObsidianAdapter({ file: workingFile, vault: 'TestVault' });
    const quests = await adapter.listQuests();
    const target = quests.find(q => q.title === 'First today task');
    // Edit the file externally to change the title
    let raw = await fs.readFile(workingFile, 'utf8');
    raw = raw.replace('First today task', 'EDITED title');
    await fs.writeFile(workingFile, raw);
    await expect(adapter.markComplete(target.sourceRef)).rejects.toMatchObject({ code: 'CONFLICT' });
  });
});

describe('ObsidianAdapter — healthCheck', () => {
  test('returns ok when file is readable + writable', async () => {
    const adapter = new ObsidianAdapter({ file: workingFile, vault: 'TestVault' });
    const result = await adapter.healthCheck();
    expect(result.status).toBe('ok');
  });

  test('returns error when file missing', async () => {
    const adapter = new ObsidianAdapter({ file: path.join(tmpDir, 'missing.md'), vault: 'TestVault' });
    const result = await adapter.healthCheck();
    expect(result.status).toBe('error');
    expect(result.lastError).toBeDefined();
  });
});
```

- [ ] **Step 2: Run tests**

```bash
npm test --workspace=server
```

Expected: all 7 ObsidianAdapter tests pass.

- [ ] **Step 3: Commit**

```bash
git add server/tests/ObsidianAdapter.test.js
git commit -m "test(adapters): markComplete write-back + conflict + health checks"
```

---

## Phase 9: Backend — Aggregator

### Task 9.1: Implement aggregator with scoring + categorization

**Files:**
- Create: `server/core/aggregator.js`
- Create: `server/tests/aggregator.test.js`

- [ ] **Step 1: Write failing tests**

Create `server/tests/aggregator.test.js`:

```js
import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';
import { ObsidianAdapter } from '../adapters/ObsidianAdapter.js';
import { createAggregator } from '../core/aggregator.js';
import { createHistoryStore } from '../core/historyStore.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const FIXTURE = path.join(__dirname, 'fixtures', 'sample-board.md');

let tmpDir;
let workingFile;
let historyFile;

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'qd-agg-'));
  workingFile = path.join(tmpDir, 'board.md');
  historyFile = path.join(tmpDir, 'history.jsonl');
  const raw = await fs.readFile(FIXTURE, 'utf8');
  await fs.writeFile(workingFile, raw);
});

afterEach(async () => {
  await fs.rm(tmpDir, { recursive: true, force: true });
});

describe('aggregator — collectAll', () => {
  test('returns scored, categorized, sorted quest list', async () => {
    const adapter = new ObsidianAdapter({ file: workingFile, vault: 'TestVault' });
    const history = createHistoryStore(historyFile);
    const agg = createAggregator([adapter], history);
    const { quests, meta } = await agg.collectAll();
    // Hidden Archive lane removed (1 task), leaving 4 visible quests.
    expect(quests.length).toBe(4);
    for (const q of quests) {
      expect(q.xp).toBeGreaterThanOrEqual(0);
      expect(q.category).toBeTruthy();
    }
    expect(meta.sources[0].id).toBe('obsidian');
    expect(meta.sources[0].status).toBe('ok');
  });

  test('quests sorted XP descending within category', async () => {
    const adapter = new ObsidianAdapter({ file: workingFile, vault: 'TestVault' });
    const history = createHistoryStore(historyFile);
    const agg = createAggregator([adapter], history);
    const { quests } = await agg.collectAll();
    const today = quests.filter(q => q.category === 'Daily Quests');
    if (today.length > 1) {
      for (let i = 1; i < today.length; i++) {
        expect(today[i].xp).toBeLessThanOrEqual(today[i - 1].xp);
      }
    }
  });

  test('source error does not block other sources', async () => {
    const goodAdapter = new ObsidianAdapter({ file: workingFile, vault: 'TestVault' });
    const badAdapter = new ObsidianAdapter({ file: path.join(tmpDir, 'missing.md'), vault: 'TestVault' });
    const history = createHistoryStore(historyFile);
    const agg = createAggregator([goodAdapter, badAdapter], history);
    const { quests, meta } = await agg.collectAll();
    expect(quests.length).toBeGreaterThan(0);
    const goodMeta = meta.sources.find(s => s.questCount > 0);
    const badMeta = meta.sources.find(s => s.status === 'error');
    expect(goodMeta).toBeDefined();
    expect(badMeta).toBeDefined();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm test --workspace=server
```

Expected: FAIL — aggregator module not found.

- [ ] **Step 3: Implement `server/core/aggregator.js`**

```js
import { computeXp, deriveFlags, stripXpTag } from './scoring.js';
import { applyRules as mapCategory } from './categoryMap.js';

export function createAggregator(adapters, historyStore) {
  let previousSnapshot = null;

  async function collectAll() {
    const sourceResults = await Promise.allSettled(
      adapters.map(a => a.listQuests())
    );

    const allQuests = [];
    const sourceMeta = [];

    for (let i = 0; i < adapters.length; i++) {
      const adapter = adapters[i];
      const result = sourceResults[i];
      if (result.status === 'fulfilled') {
        const enriched = result.value.map(q => enrichQuest(q));
        const visible = enriched.filter(q => q.__visible);
        allQuests.push(...visible);
        sourceMeta.push({ id: adapter.getId(), status: 'ok', questCount: visible.length });
      } else {
        sourceMeta.push({ id: adapter.getId(), status: 'error', error: result.reason.message });
      }
    }

    // Detect new completions
    if (previousSnapshot) {
      const newCompletions = detectCompletions(previousSnapshot, allQuests);
      const deduped = [];
      for (const event of newCompletions) {
        if (!(await historyStore.isDuplicate(event.questId, new Date(event.ts)))) {
          deduped.push(event);
        }
      }
      if (deduped.length > 0) await historyStore.appendBatch(deduped);
    }
    previousSnapshot = allQuests.map(snapshotShape);

    return {
      quests: sortQuests(allQuests),
      categories: orderedCategories(allQuests),
      meta: {
        lastSyncAt: new Date().toISOString(),
        sources: sourceMeta,
      },
    };
  }

  return { collectAll };
}

const CATEGORY_ORDER = ['Daily Quests', 'Job Hunt', 'Personal Dev', 'Project B', 'Project A', 'Side Quests'];

function enrichQuest(q) {
  const mapping = mapCategory(q.rawLane);
  if (mapping.hidden) return { ...q, __visible: false };
  const { xp, xpSource } = computeXp({ title: q.title, rawLane: q.rawLane });
  const cleanTitle = stripXpTag(q.title);
  const flags = deriveFlags(cleanTitle);
  return {
    ...q,
    title: cleanTitle,
    xp,
    xpSource,
    flags,
    category: mapping.category,
    featured: mapping.featured,
    __visible: true,
  };
}

function snapshotShape(q) {
  return { id: q.id, completed: q.completed, completedAt: q.completedAt, xp: q.xp, title: q.title };
}

function detectCompletions(prev, current) {
  const prevMap = new Map(prev.map(p => [p.id, p]));
  const events = [];
  for (const q of current) {
    const prior = prevMap.get(q.id);
    if (q.completed && prior && !prior.completed) {
      events.push({
        ts: q.completedAt || new Date().toISOString(),
        questId: q.id,
        xp: q.xp,
        source: q.sourceId,
        title: q.title,
      });
    }
  }
  return events;
}

function sortQuests(quests) {
  return [...quests].sort((a, b) => {
    if (a.category !== b.category) {
      return categoryRank(a.category) - categoryRank(b.category);
    }
    if (a.completed !== b.completed) return a.completed ? 1 : -1;
    if (b.xp !== a.xp) return b.xp - a.xp;
    return a.title.localeCompare(b.title);
  });
}

function orderedCategories(quests) {
  const seen = new Set(quests.map(q => q.category));
  const ordered = CATEGORY_ORDER.filter(c => seen.has(c));
  for (const cat of seen) if (!ordered.includes(cat)) ordered.push(cat);
  return ordered;
}

function categoryRank(category) {
  const idx = CATEGORY_ORDER.indexOf(category);
  return idx === -1 ? CATEGORY_ORDER.length : idx;
}
```

- [ ] **Step 4: Run tests**

```bash
npm test --workspace=server
```

Expected: 3 passing aggregator tests + all earlier tests.

- [ ] **Step 5: Commit**

```bash
git add server/core/aggregator.js server/tests/aggregator.test.js
git commit -m "feat(core): aggregator collectAll with scoring, sorting, error isolation"
```

---

### Task 9.2: Test completion diff detection

- [ ] **Step 1: Add diff-detection test**

Append to `server/tests/aggregator.test.js`:

```js
describe('aggregator — completion diff', () => {
  test('appends XP event when quest transitions to completed', async () => {
    const adapter = new ObsidianAdapter({ file: workingFile, vault: 'TestVault' });
    const history = createHistoryStore(historyFile);
    const agg = createAggregator([adapter], history);

    // First call: no diff
    await agg.collectAll();
    const eventsAfterFirst = await history.readAll();
    expect(eventsAfterFirst.length).toBe(0);

    // Externally mark a quest complete
    let raw = await fs.readFile(workingFile, 'utf8');
    raw = raw.replace('- [ ] First today task', '- [x] First today task ✅ 2026-05-18');
    await fs.writeFile(workingFile, raw);

    // Second call: diff detected, event appended
    await agg.collectAll();
    const eventsAfterSecond = await history.readAll();
    expect(eventsAfterSecond.length).toBe(1);
    expect(eventsAfterSecond[0].title).toBe('First today task');
  });
});
```

- [ ] **Step 2: Run tests**

```bash
npm test --workspace=server
```

Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add server/tests/aggregator.test.js
git commit -m "test(aggregator): completion diff appends XP event"
```

---

## Phase 10: Backend — HTTP Routes

### Task 10.1: Implement GET /api/quests

**Files:**
- Create: `server/routes/quests.js`
- Create: `server/tests/routes.test.js`

- [ ] **Step 1: Add supertest dependency**

```bash
npm install --workspace=server --save-dev supertest
```

- [ ] **Step 2: Write failing test**

Create `server/tests/routes.test.js`:

```js
import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';
import express from 'express';
import request from 'supertest';
import { ObsidianAdapter } from '../adapters/ObsidianAdapter.js';
import { createAggregator } from '../core/aggregator.js';
import { createHistoryStore } from '../core/historyStore.js';
import { createQuestsRoute } from '../routes/quests.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const FIXTURE = path.join(__dirname, 'fixtures', 'sample-board.md');

async function buildApp() {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'qd-routes-'));
  const workingFile = path.join(tmpDir, 'board.md');
  const historyFile = path.join(tmpDir, 'history.jsonl');
  await fs.writeFile(workingFile, await fs.readFile(FIXTURE, 'utf8'));

  const adapter = new ObsidianAdapter({ file: workingFile, vault: 'V' });
  const history = createHistoryStore(historyFile);
  const aggregator = createAggregator([adapter], history);

  const app = express();
  app.use('/api/quests', createQuestsRoute({ aggregator }));

  return { app, tmpDir, adapter, history, aggregator };
}

describe('GET /api/quests', () => {
  test('returns 200 with quest list', async () => {
    const { app, tmpDir } = await buildApp();
    try {
      const res = await request(app).get('/api/quests');
      expect(res.status).toBe(200);
      expect(res.body.quests).toBeInstanceOf(Array);
      expect(res.body.quests.length).toBeGreaterThan(0);
      expect(res.body.categories).toBeInstanceOf(Array);
      expect(res.body.meta.sources[0].id).toBe('obsidian');
    } finally {
      await fs.rm(tmpDir, { recursive: true, force: true });
    }
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

```bash
npm test --workspace=server
```

Expected: FAIL.

- [ ] **Step 4: Implement `server/routes/quests.js`**

```js
import { Router } from 'express';

export function createQuestsRoute({ aggregator }) {
  const router = Router();

  router.get('/', async (req, res, next) => {
    try {
      const result = await aggregator.collectAll();
      res.json(result);
    } catch (err) {
      next(err);
    }
  });

  return router;
}
```

- [ ] **Step 5: Run tests**

```bash
npm test --workspace=server
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add server/routes/quests.js server/tests/routes.test.js package.json package-lock.json
git commit -m "feat(routes): GET /api/quests"
```

---

### Task 10.2: Implement POST /api/quests/:id/complete

**Files:**
- Create: `server/routes/actions.js`

- [ ] **Step 1: Append test for complete endpoint**

Add to `server/tests/routes.test.js`:

```js
import { createActionsRoute } from '../routes/actions.js';

async function buildAppWithActions() {
  const built = await buildApp();
  built.app.use(express.json());
  built.app.use('/api/quests', createActionsRoute({ aggregator: built.aggregator, adaptersById: { obsidian: built.adapter }, history: built.history }));
  return built;
}

describe('POST /api/quests/:id/complete', () => {
  test('marks quest complete and returns success', async () => {
    const { app, tmpDir, aggregator } = await buildAppWithActions();
    try {
      const { quests } = await aggregator.collectAll();
      const target = quests[0];
      const res = await request(app).post(`/api/quests/${encodeURIComponent(target.id)}/complete`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.xpAwarded).toBe(target.xp);
    } finally {
      await fs.rm(tmpDir, { recursive: true, force: true });
    }
  });

  test('returns 404 for unknown quest id', async () => {
    const { app, tmpDir } = await buildAppWithActions();
    try {
      const res = await request(app).post('/api/quests/nonexistent/complete');
      expect(res.status).toBe(404);
      expect(res.body.error).toBe('not_found');
    } finally {
      await fs.rm(tmpDir, { recursive: true, force: true });
    }
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm test --workspace=server
```

Expected: FAIL — actions module not found.

- [ ] **Step 3: Implement `server/routes/actions.js`**

```js
import { Router } from 'express';
import { ConflictError } from '../adapters/SyncAdapter.js';

export function createActionsRoute({ aggregator, adaptersById, history }) {
  const router = Router();

  router.post('/:id/complete', async (req, res, next) => {
    try {
      const { quests } = await aggregator.collectAll();
      const quest = quests.find(q => q.id === req.params.id);
      if (!quest) {
        return res.status(404).json({ error: 'not_found' });
      }
      if (quest.completed) {
        return res.json({ success: true, quest, xpAwarded: 0 });
      }
      const adapter = adaptersById[quest.sourceId];
      if (!adapter) {
        return res.status(500).json({ error: 'adapter_missing' });
      }
      try {
        await adapter.markComplete(quest.sourceRef);
      } catch (err) {
        if (err instanceof ConflictError || err.code === 'CONFLICT') {
          return res.status(409).json({ error: 'quest_changed', message: err.message });
        }
        throw err;
      }
      await history.appendEvent({
        ts: new Date().toISOString(),
        questId: quest.id,
        xp: quest.xp,
        source: quest.sourceId,
        title: quest.title,
      });
      const updatedQuest = { ...quest, completed: true, completedAt: new Date().toISOString() };
      res.json({ success: true, quest: updatedQuest, xpAwarded: quest.xp });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
```

- [ ] **Step 4: Run tests**

```bash
npm test --workspace=server
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add server/routes/actions.js server/tests/routes.test.js
git commit -m "feat(routes): POST /api/quests/:id/complete with conflict + 404 handling"
```

---

### Task 10.3: Implement GET /api/history

**Files:**
- Create: `server/routes/history.js`

- [ ] **Step 1: Append test**

Add to `server/tests/routes.test.js`:

```js
import { createHistoryRoute } from '../routes/history.js';

describe('GET /api/history', () => {
  test('returns today/week sums + streak', async () => {
    const built = await buildApp();
    built.app.use('/api/history', createHistoryRoute({ history: built.history, targets: { daily: 50, weekly: 250 } }));
    try {
      const res = await request(built.app).get('/api/history');
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('today.xp');
      expect(res.body).toHaveProperty('week.xp');
      expect(res.body).toHaveProperty('streak');
      expect(res.body).toHaveProperty('rollingAvg7Day');
    } finally {
      await fs.rm(built.tmpDir, { recursive: true, force: true });
    }
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm test --workspace=server
```

Expected: FAIL.

- [ ] **Step 3: Implement `server/routes/history.js`**

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

      res.json({
        today: { xp: todayXp, target: targets.daily },
        week: { xp: weekXp, target: targets.weekly },
        rollingAvg7Day: { daily: Math.round(rollingDaily), weekly: Math.round(rollingWeekly) },
        streak,
        totalDays,
        useRollingAvg: totalDays >= 7,
      });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
```

- [ ] **Step 4: Run tests**

```bash
npm test --workspace=server
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add server/routes/history.js server/tests/routes.test.js
git commit -m "feat(routes): GET /api/history with today/week sums, streak, rolling avg"
```

---

### Task 10.4: Implement GET /api/health

**Files:**
- Create: `server/routes/health.js`

- [ ] **Step 1: Append test**

Add to `server/tests/routes.test.js`:

```js
import { createHealthRoute } from '../routes/health.js';

describe('GET /api/health', () => {
  test('returns ok status when source healthy', async () => {
    const built = await buildApp();
    built.app.use('/api/health', createHealthRoute({ adapters: [built.adapter] }));
    try {
      const res = await request(built.app).get('/api/health');
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('ok');
      expect(res.body.sources[0].id).toBe('obsidian');
    } finally {
      await fs.rm(built.tmpDir, { recursive: true, force: true });
    }
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm test --workspace=server
```

Expected: FAIL.

- [ ] **Step 3: Implement `server/routes/health.js`**

```js
import { Router } from 'express';

export function createHealthRoute({ adapters }) {
  const router = Router();

  router.get('/', async (req, res, next) => {
    try {
      const results = await Promise.all(adapters.map(async (a) => {
        const h = await a.healthCheck();
        return {
          id: a.getId(),
          status: h.status,
          lastError: h.lastError ?? null,
          lastSuccess: h.status === 'ok' ? new Date().toISOString() : null,
        };
      }));
      const overall = results.every(r => r.status === 'ok') ? 'ok' : 'degraded';
      res.json({ status: overall, sources: results });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
```

- [ ] **Step 4: Run tests**

```bash
npm test --workspace=server
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add server/routes/health.js server/tests/routes.test.js
git commit -m "feat(routes): GET /api/health per-source check"
```

---

## Phase 11: Backend — Server Bootstrap

### Task 11.1: Implement server/index.js with config loading

**Files:**
- Modify: `server/index.js`
- Create: `server/core/configLoader.js`
- Create: `config/sources.example.json`
- Create: `config/targets.example.json`

- [ ] **Step 1: Create `server/core/configLoader.js`**

```js
import { promises as fs } from 'fs';
import path from 'path';

export async function loadConfig(rootDir) {
  const configDir = path.join(rootDir, 'config');
  const sourcesPath = path.join(configDir, 'sources.json');
  const targetsPath = path.join(configDir, 'targets.json');

  const [sources, targets] = await Promise.all([
    readJsonOrThrow(sourcesPath, 'sources.json is required'),
    readJsonOrDefault(targetsPath, { daily: 50, weekly: 250 }),
  ]);

  return { sources, targets };
}

async function readJsonOrThrow(filePath, errMsg) {
  try {
    return JSON.parse(await fs.readFile(filePath, 'utf8'));
  } catch (err) {
    if (err.code === 'ENOENT') {
      throw new Error(`${errMsg} — expected at ${filePath}`);
    }
    throw err;
  }
}

async function readJsonOrDefault(filePath, defaultValue) {
  try {
    return JSON.parse(await fs.readFile(filePath, 'utf8'));
  } catch (err) {
    if (err.code === 'ENOENT') return defaultValue;
    throw err;
  }
}
```

- [ ] **Step 2: Create `config/sources.example.json`**

```json
{
  "sources": [
    {
      "id": "obsidian",
      "adapter": "ObsidianAdapter",
      "config": {
        "file": "/absolute/path/to/your/vault/Tasks/your-board.md",
        "vault": "YourVaultName"
      },
      "pollIntervalSec": 60
    }
  ]
}
```

- [ ] **Step 3: Create `config/targets.example.json`**

```json
{
  "daily": 50,
  "weekly": 250
}
```

- [ ] **Step 4: Replace `server/index.js` with full bootstrap**

```js
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { loadConfig } from './core/configLoader.js';
import { ObsidianAdapter } from './adapters/ObsidianAdapter.js';
import { createAggregator } from './core/aggregator.js';
import { createHistoryStore } from './core/historyStore.js';
import { createQuestsRoute } from './routes/quests.js';
import { createActionsRoute } from './routes/actions.js';
import { createHistoryRoute } from './routes/history.js';
import { createHealthRoute } from './routes/health.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '..');
const PORT = process.env.PORT || 3000;

const ADAPTER_REGISTRY = {
  ObsidianAdapter,
};

async function main() {
  const { sources, targets } = await loadConfig(PROJECT_ROOT);

  const adapters = sources.sources.map((s) => {
    const Cls = ADAPTER_REGISTRY[s.adapter];
    if (!Cls) throw new Error(`Unknown adapter: ${s.adapter}`);
    return new Cls(s.config);
  });
  const adaptersById = Object.fromEntries(adapters.map(a => [a.getId(), a]));

  const historyPath = path.join(PROJECT_ROOT, 'data', 'xp-history.jsonl');
  const history = createHistoryStore(historyPath);
  const aggregator = createAggregator(adapters, history);

  const app = express();
  app.use(express.json());

  app.use('/api/quests', createQuestsRoute({ aggregator }));
  app.use('/api/quests', createActionsRoute({ aggregator, adaptersById, history }));
  app.use('/api/history', createHistoryRoute({ history, targets }));
  app.use('/api/health', createHealthRoute({ adapters }));

  // Serve client build in production mode
  const distPath = path.join(PROJECT_ROOT, 'client', 'dist');
  app.use(express.static(distPath));

  app.use((err, req, res, _next) => {
    console.error('Server error:', err);
    res.status(500).json({ error: 'internal', message: err.message });
  });

  app.listen(PORT, '127.0.0.1', () => {
    console.log(`Quest Dashboard API listening on http://localhost:${PORT}`);
    console.log(`Loaded ${adapters.length} adapter(s): ${adapters.map(a => a.getId()).join(', ')}`);
  });
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
```

- [ ] **Step 5: Smoke test — bootstrap server against real kanban**

```bash
mkdir -p config data
cp config/sources.example.json config/sources.json
cp config/targets.example.json config/targets.json
node server/index.js &
sleep 2
curl -s http://localhost:3000/api/health | head
curl -s http://localhost:3000/api/quests | head -c 500
kill %1
```

Expected: `health` returns `{"status":"ok",...}`; `quests` returns a JSON object with `quests` and `categories` arrays.

- [ ] **Step 6: Commit**

```bash
git add server/index.js server/core/configLoader.js config/sources.example.json config/targets.example.json
git commit -m "feat(server): bootstrap with config loader + adapter registry"
```

---

## Phase 12: Frontend — API Client + Hooks

### Task 12.1: Implement `lib/api.js` fetch wrappers

**Files:**
- Create: `client/src/lib/api.js`
- Create: `client/src/tests/api.test.js`

- [ ] **Step 1: Write failing tests**

Create `client/src/tests/api.test.js`:

```js
import { describe, test, expect, vi, beforeEach } from 'vitest';
import { fetchQuests, fetchHistory, postComplete } from '../lib/api.js';

beforeEach(() => {
  global.fetch = vi.fn();
});

describe('fetchQuests', () => {
  test('GETs /api/quests and returns JSON', async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({ quests: [], categories: [] }),
    });
    const result = await fetchQuests();
    expect(global.fetch).toHaveBeenCalledWith('/api/quests');
    expect(result.quests).toEqual([]);
  });

  test('throws on non-ok response', async () => {
    global.fetch.mockResolvedValue({ ok: false, status: 500 });
    await expect(fetchQuests()).rejects.toThrow('500');
  });
});

describe('postComplete', () => {
  test('POSTs to /api/quests/:id/complete', async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ success: true, xpAwarded: 25 }),
    });
    const result = await postComplete('quest-id-1');
    expect(global.fetch).toHaveBeenCalledWith('/api/quests/quest-id-1/complete', { method: 'POST' });
    expect(result.success).toBe(true);
  });

  test('throws Conflict on 409', async () => {
    global.fetch.mockResolvedValue({ ok: false, status: 409, json: async () => ({ error: 'quest_changed' }) });
    await expect(postComplete('q')).rejects.toMatchObject({ code: 'CONFLICT' });
  });
});

describe('fetchHistory', () => {
  test('GETs /api/history', async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({ today: { xp: 50 }, week: { xp: 200 }, streak: 3 }),
    });
    const result = await fetchHistory();
    expect(global.fetch).toHaveBeenCalledWith('/api/history');
    expect(result.streak).toBe(3);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm test --workspace=client
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement `client/src/lib/api.js`**

```js
export async function fetchQuests() {
  const res = await fetch('/api/quests');
  if (!res.ok) throw new Error(`fetchQuests failed: ${res.status}`);
  return res.json();
}

export async function fetchHistory() {
  const res = await fetch('/api/history');
  if (!res.ok) throw new Error(`fetchHistory failed: ${res.status}`);
  return res.json();
}

export async function postComplete(questId) {
  const res = await fetch(`/api/quests/${encodeURIComponent(questId)}/complete`, { method: 'POST' });
  if (!res.ok) {
    if (res.status === 409) {
      const err = new Error('quest_changed');
      err.code = 'CONFLICT';
      throw err;
    }
    throw new Error(`postComplete failed: ${res.status}`);
  }
  return res.json();
}

export async function fetchHealth() {
  const res = await fetch('/api/health');
  if (!res.ok) throw new Error(`fetchHealth failed: ${res.status}`);
  return res.json();
}
```

- [ ] **Step 4: Run tests**

```bash
npm test --workspace=client
```

Expected: 5 passing tests.

- [ ] **Step 5: Commit**

```bash
git add client/src/lib/api.js client/src/tests/api.test.js
git commit -m "feat(client): API client wrappers with conflict handling"
```

---

### Task 12.2: Implement `useQuests` hook with polling

**Files:**
- Create: `client/src/hooks/useQuests.js`

- [ ] **Step 1: Implement hook (no separate test — covered by component tests later)**

Create `client/src/hooks/useQuests.js`:

```js
import { useEffect, useState, useCallback, useRef } from 'react';
import { fetchQuests } from '../lib/api.js';

const POLL_INTERVAL_MS = 60_000;

export function useQuests() {
  const [data, setData] = useState({ quests: [], categories: [], meta: null });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const mountedRef = useRef(true);

  const refetch = useCallback(async () => {
    try {
      const result = await fetchQuests();
      if (!mountedRef.current) return;
      setData(result);
      setError(null);
    } catch (err) {
      if (!mountedRef.current) return;
      setError(err);
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    refetch();
    const id = setInterval(refetch, POLL_INTERVAL_MS);
    return () => {
      mountedRef.current = false;
      clearInterval(id);
    };
  }, [refetch]);

  return { ...data, loading, error, refetch };
}
```

- [ ] **Step 2: Commit**

```bash
git add client/src/hooks/useQuests.js
git commit -m "feat(client): useQuests hook with 60s polling"
```

---

### Task 12.3: Implement `useHistory` and `useShowCompleted` hooks

**Files:**
- Create: `client/src/hooks/useHistory.js`
- Create: `client/src/hooks/useShowCompleted.js`

- [ ] **Step 1: Implement `client/src/hooks/useHistory.js`**

```js
import { useEffect, useState, useCallback } from 'react';
import { fetchHistory } from '../lib/api.js';

const POLL_INTERVAL_MS = 60_000;

export function useHistory() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  const refetch = useCallback(async () => {
    try {
      const result = await fetchHistory();
      setData(result);
      setError(null);
    } catch (err) {
      setError(err);
    }
  }, []);

  useEffect(() => {
    refetch();
    const id = setInterval(refetch, POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [refetch]);

  return { history: data, error, refetch };
}
```

- [ ] **Step 2: Implement `client/src/hooks/useShowCompleted.js`**

```js
import { useState, useEffect, useCallback } from 'react';

const STORAGE_KEY = 'qd:show-completed';

export function useShowCompleted() {
  const [show, setShow] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY)) === true;
    } catch {
      return false;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(show));
    } catch {
      // ignore
    }
  }, [show]);

  const toggle = useCallback(() => setShow(s => !s), []);

  return { show, toggle };
}
```

- [ ] **Step 3: Commit**

```bash
git add client/src/hooks/
git commit -m "feat(client): useHistory + useShowCompleted hooks"
```

---

## Phase 13: Frontend — Leaf Components

### Task 13.1: XpBadge component

**Files:**
- Create: `client/src/components/XpBadge.jsx`
- Create: `client/src/tests/XpBadge.test.jsx`

- [ ] **Step 1: Write failing test**

Create `client/src/tests/XpBadge.test.jsx`:

```jsx
import { describe, test, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { XpBadge } from '../components/XpBadge.jsx';

describe('XpBadge', () => {
  test('renders the XP value', () => {
    render(<XpBadge value={25} xpSource="auto" />);
    expect(screen.getByText(/25/)).toBeInTheDocument();
  });

  test('shows tag indicator when xpSource is tag', () => {
    render(<XpBadge value={50} xpSource="tag" />);
    expect(screen.getByTestId('xp-badge')).toHaveAttribute('data-xp-source', 'tag');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm test --workspace=client
```

Expected: FAIL.

- [ ] **Step 3: Implement `client/src/components/XpBadge.jsx`**

```jsx
export function XpBadge({ value, xpSource = 'auto' }) {
  const isTag = xpSource === 'tag';
  return (
    <span
      data-testid="xp-badge"
      data-xp-source={xpSource}
      className={`inline-flex items-center px-2 py-0.5 text-xs font-bold border ${
        isTag
          ? 'text-hud-xp border-hud-xp border-dashed glow'
          : 'text-hud-accent border-hud-accent'
      }`}
    >
      {value} XP
    </span>
  );
}
```

- [ ] **Step 4: Run tests**

```bash
npm test --workspace=client
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add client/src/components/XpBadge.jsx client/src/tests/XpBadge.test.jsx
git commit -m "feat(client): XpBadge component with auto/tag variants"
```

---

### Task 13.2: FlagIcons component

**Files:**
- Create: `client/src/components/FlagIcons.jsx`
- Create: `client/src/tests/FlagIcons.test.jsx`

- [ ] **Step 1: Write failing test**

Create `client/src/tests/FlagIcons.test.jsx`:

```jsx
import { describe, test, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { FlagIcons } from '../components/FlagIcons.jsx';

describe('FlagIcons', () => {
  test('renders nothing when empty', () => {
    const { container } = render(<FlagIcons flags={[]} />);
    expect(container.firstChild).toBeNull();
  });

  test('renders icons for each flag', () => {
    render(<FlagIcons flags={['urgent', 'starred']} />);
    expect(screen.getByTitle('Urgent')).toBeInTheDocument();
    expect(screen.getByTitle('Starred')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm test --workspace=client
```

Expected: FAIL.

- [ ] **Step 3: Implement `client/src/components/FlagIcons.jsx`**

```jsx
const FLAG_META = {
  urgent: { glyph: '🔥', title: 'Urgent' },
  starred: { glyph: '⭐', title: 'Starred' },
  critical: { glyph: '🔺', title: 'Critical' },
};

export function FlagIcons({ flags = [] }) {
  if (flags.length === 0) return null;
  return (
    <span className="inline-flex gap-1 text-sm">
      {flags.map(flag => {
        const meta = FLAG_META[flag];
        if (!meta) return null;
        return (
          <span key={flag} title={meta.title} aria-label={meta.title}>
            {meta.glyph}
          </span>
        );
      })}
    </span>
  );
}
```

- [ ] **Step 4: Run tests**

```bash
npm test --workspace=client
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add client/src/components/FlagIcons.jsx client/src/tests/FlagIcons.test.jsx
git commit -m "feat(client): FlagIcons component"
```

---

### Task 13.3: ObjectivesBar component

**Files:**
- Create: `client/src/components/ObjectivesBar.jsx`
- Create: `client/src/tests/ObjectivesBar.test.jsx`

- [ ] **Step 1: Write failing test**

Create `client/src/tests/ObjectivesBar.test.jsx`:

```jsx
import { describe, test, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ObjectivesBar } from '../components/ObjectivesBar.jsx';

describe('ObjectivesBar', () => {
  test('renders nothing when total is zero', () => {
    const { container } = render(<ObjectivesBar done={0} total={0} />);
    expect(container.firstChild).toBeNull();
  });

  test('shows "done/total Objectives" label', () => {
    render(<ObjectivesBar done={2} total={6} />);
    expect(screen.getByText(/2\/6/)).toBeInTheDocument();
  });

  test('fill percentage matches ratio', () => {
    render(<ObjectivesBar done={3} total={6} />);
    const fill = screen.getByTestId('objectives-fill');
    expect(fill).toHaveStyle({ width: '50%' });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm test --workspace=client
```

Expected: FAIL.

- [ ] **Step 3: Implement `client/src/components/ObjectivesBar.jsx`**

```jsx
export function ObjectivesBar({ done, total }) {
  if (total === 0) return null;
  const pct = Math.round((done / total) * 100);
  return (
    <div className="w-full mt-2">
      <div className="flex justify-between text-[10px] uppercase opacity-70">
        <span>Objectives</span>
        <span>{done}/{total}</span>
      </div>
      <div className="h-1 bg-hud-border mt-1 overflow-hidden">
        <div
          data-testid="objectives-fill"
          className="h-full bg-hud-accent"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run tests**

```bash
npm test --workspace=client
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add client/src/components/ObjectivesBar.jsx client/src/tests/ObjectivesBar.test.jsx
git commit -m "feat(client): ObjectivesBar component"
```

---

### Task 13.4: ProgressBar component

**Files:**
- Create: `client/src/components/ProgressBar.jsx`
- Create: `client/src/tests/ProgressBar.test.jsx`

- [ ] **Step 1: Write failing test**

Create `client/src/tests/ProgressBar.test.jsx`:

```jsx
import { describe, test, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ProgressBar } from '../components/ProgressBar.jsx';

describe('ProgressBar', () => {
  test('renders label, current/target, fill percentage', () => {
    render(<ProgressBar label="DAILY" current={30} target={100} />);
    expect(screen.getByText(/DAILY/)).toBeInTheDocument();
    expect(screen.getByText(/30\s*\/\s*100/)).toBeInTheDocument();
    const fill = screen.getByTestId('progress-fill');
    expect(fill).toHaveStyle({ width: '30%' });
  });

  test('caps fill at 100% even when current exceeds target', () => {
    render(<ProgressBar label="X" current={150} target={100} />);
    const fill = screen.getByTestId('progress-fill');
    expect(fill).toHaveStyle({ width: '100%' });
  });

  test('renders marker line when ambitionTarget provided', () => {
    render(<ProgressBar label="X" current={30} target={50} ambitionTarget={80} />);
    expect(screen.getByTestId('ambition-marker')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm test --workspace=client
```

Expected: FAIL.

- [ ] **Step 3: Implement `client/src/components/ProgressBar.jsx`**

```jsx
export function ProgressBar({ label, current, target, ambitionTarget, size = 'lg' }) {
  const pct = target > 0 ? Math.min(100, Math.round((current / target) * 100)) : 0;
  const ambitionPct = ambitionTarget ? Math.min(100, Math.round((ambitionTarget / target) * 100)) : null;
  const heights = { lg: 'h-4', sm: 'h-2' };

  return (
    <div className="w-full">
      <div className="flex justify-between text-xs uppercase opacity-90">
        <span className="tracking-widest">{label}</span>
        <span>{current} / {target} XP</span>
      </div>
      <div className={`${heights[size]} relative bg-hud-border mt-1 border border-hud-border overflow-hidden`}>
        <div
          data-testid="progress-fill"
          className="h-full bg-hud-accent transition-[width] duration-700 ease-out"
          style={{ width: `${pct}%` }}
        />
        {ambitionPct !== null && (
          <div
            data-testid="ambition-marker"
            className="absolute top-0 bottom-0 w-px bg-hud-xp opacity-70"
            style={{ left: `${ambitionPct}%` }}
          />
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run tests**

```bash
npm test --workspace=client
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add client/src/components/ProgressBar.jsx client/src/tests/ProgressBar.test.jsx
git commit -m "feat(client): ProgressBar with ambition marker"
```

---

### Task 13.5: StreakBadge, ShowCompletedToggle, SyncIndicator (small components)

**Files:**
- Create: `client/src/components/StreakBadge.jsx`
- Create: `client/src/components/ShowCompletedToggle.jsx`
- Create: `client/src/components/SyncIndicator.jsx`

- [ ] **Step 1: Create `client/src/components/StreakBadge.jsx`**

```jsx
export function StreakBadge({ days }) {
  return (
    <span className="text-xs uppercase tracking-widest opacity-80">
      Streak: <span className="text-hud-success font-bold">{days}</span> {days === 1 ? 'day' : 'days'}
    </span>
  );
}
```

- [ ] **Step 2: Create `client/src/components/ShowCompletedToggle.jsx`**

```jsx
export function ShowCompletedToggle({ show, onToggle }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={`px-2 py-1 text-xs uppercase tracking-widest border transition-colors ${
        show ? 'border-hud-success text-hud-success' : 'border-hud-border text-hud-border'
      }`}
      aria-pressed={show}
    >
      {show ? '☑ Show Completed' : '☐ Show Completed'}
    </button>
  );
}
```

- [ ] **Step 3: Create `client/src/components/SyncIndicator.jsx`**

```jsx
import { useEffect, useState } from 'react';

export function SyncIndicator({ lastSyncAt, onRefresh }) {
  const [ago, setAgo] = useState('');

  useEffect(() => {
    if (!lastSyncAt) return;
    const tick = () => {
      const seconds = Math.max(0, Math.floor((Date.now() - new Date(lastSyncAt).getTime()) / 1000));
      if (seconds < 60) setAgo(`${seconds}s ago`);
      else if (seconds < 3600) setAgo(`${Math.floor(seconds / 60)}m ago`);
      else setAgo(`${Math.floor(seconds / 3600)}h ago`);
    };
    tick();
    const id = setInterval(tick, 5000);
    return () => clearInterval(id);
  }, [lastSyncAt]);

  return (
    <span className="text-xs opacity-70 inline-flex items-center gap-2">
      <span>Synced {ago || '—'}</span>
      <button
        type="button"
        onClick={onRefresh}
        className="px-1 border border-hud-border hover:border-hud-accent"
        aria-label="Refresh"
      >
        ⟳
      </button>
    </span>
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add client/src/components/StreakBadge.jsx client/src/components/ShowCompletedToggle.jsx client/src/components/SyncIndicator.jsx
git commit -m "feat(client): StreakBadge, ShowCompletedToggle, SyncIndicator"
```

---

## Phase 14: Frontend — Quest Card + Modal

### Task 14.1: QuestCard component

**Files:**
- Create: `client/src/components/QuestCard.jsx`
- Create: `client/src/tests/QuestCard.test.jsx`

- [ ] **Step 1: Write failing test**

Create `client/src/tests/QuestCard.test.jsx`:

```jsx
import { describe, test, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { QuestCard } from '../components/QuestCard.jsx';

const sampleQuest = {
  id: 'q1',
  title: 'Apply to Vercel',
  xp: 35,
  xpSource: 'auto',
  flags: ['urgent'],
  objectiveProgress: { done: 1, total: 3 },
  completed: false,
};

describe('QuestCard', () => {
  test('renders title, XP, flags', () => {
    render(<QuestCard quest={sampleQuest} onClick={() => {}} />);
    expect(screen.getByText('Apply to Vercel')).toBeInTheDocument();
    expect(screen.getByText(/35/)).toBeInTheDocument();
    expect(screen.getByTitle('Urgent')).toBeInTheDocument();
  });

  test('shows objectives bar when total > 0', () => {
    render(<QuestCard quest={sampleQuest} onClick={() => {}} />);
    expect(screen.getByText(/1\/3/)).toBeInTheDocument();
  });

  test('omits objectives bar when no objectives', () => {
    const quest = { ...sampleQuest, objectiveProgress: { done: 0, total: 0 } };
    render(<QuestCard quest={quest} onClick={() => {}} />);
    expect(screen.queryByText(/Objectives/i)).not.toBeInTheDocument();
  });

  test('fires onClick when card clicked', () => {
    const handler = vi.fn();
    render(<QuestCard quest={sampleQuest} onClick={handler} />);
    fireEvent.click(screen.getByRole('button'));
    expect(handler).toHaveBeenCalledWith(sampleQuest);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm test --workspace=client
```

Expected: FAIL.

- [ ] **Step 3: Implement `client/src/components/QuestCard.jsx`**

```jsx
import { XpBadge } from './XpBadge.jsx';
import { FlagIcons } from './FlagIcons.jsx';
import { ObjectivesBar } from './ObjectivesBar.jsx';

export function QuestCard({ quest, onClick }) {
  return (
    <button
      type="button"
      onClick={() => onClick(quest)}
      className="group text-left w-full p-3 bg-hud-surface border border-hud-border hover:border-hud-accent transition-colors relative overflow-hidden"
    >
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-sm font-semibold leading-snug line-clamp-2 text-hud-accent">
          {quest.title}
        </h3>
        <XpBadge value={quest.xp} xpSource={quest.xpSource} />
      </div>
      <div className="mt-2 flex items-center gap-2">
        <FlagIcons flags={quest.flags} />
      </div>
      <ObjectivesBar done={quest.objectiveProgress.done} total={quest.objectiveProgress.total} />
    </button>
  );
}
```

- [ ] **Step 4: Run tests**

```bash
npm test --workspace=client
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add client/src/components/QuestCard.jsx client/src/tests/QuestCard.test.jsx
git commit -m "feat(client): QuestCard composing XpBadge + FlagIcons + ObjectivesBar"
```

---

### Task 14.2: CompletedQuestCard variant

**Files:**
- Create: `client/src/components/CompletedQuestCard.jsx`
- Create: `client/src/tests/CompletedQuestCard.test.jsx`

- [ ] **Step 1: Write failing test**

Create `client/src/tests/CompletedQuestCard.test.jsx`:

```jsx
import { describe, test, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CompletedQuestCard } from '../components/CompletedQuestCard.jsx';

describe('CompletedQuestCard', () => {
  test('renders title with strikethrough class', () => {
    render(<CompletedQuestCard quest={{ id: 'x', title: 'Done thing', completedAt: '2026-05-15T00:00:00Z' }} />);
    expect(screen.getByText('Done thing').className).toContain('line-through');
  });

  test('shows completion date', () => {
    render(<CompletedQuestCard quest={{ id: 'x', title: 'Done', completedAt: '2026-05-15T00:00:00Z' }} />);
    expect(screen.getByText(/2026-05-15/)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm test --workspace=client
```

Expected: FAIL.

- [ ] **Step 3: Implement `client/src/components/CompletedQuestCard.jsx`**

```jsx
export function CompletedQuestCard({ quest }) {
  const dateStr = quest.completedAt ? quest.completedAt.slice(0, 10) : '';
  return (
    <div className="p-3 border border-hud-border opacity-30 select-none">
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-sm leading-snug line-through text-hud-accent">{quest.title}</h3>
        <span className="text-hud-success" aria-label="completed">✓</span>
      </div>
      {dateStr && <p className="text-[10px] mt-1 opacity-70">{dateStr}</p>}
    </div>
  );
}
```

- [ ] **Step 4: Run tests**

```bash
npm test --workspace=client
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add client/src/components/CompletedQuestCard.jsx client/src/tests/CompletedQuestCard.test.jsx
git commit -m "feat(client): CompletedQuestCard variant"
```

---

### Task 14.3: QuestModal component

**Files:**
- Create: `client/src/components/QuestModal.jsx`
- Create: `client/src/tests/QuestModal.test.jsx`

- [ ] **Step 1: Write failing test**

Create `client/src/tests/QuestModal.test.jsx`:

```jsx
import { describe, test, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { QuestModal } from '../components/QuestModal.jsx';

const sampleQuest = {
  id: 'q1',
  title: 'Apply to Vercel',
  xp: 35,
  xpSource: 'auto',
  flags: [],
  category: 'Job Hunt',
  rawLane: '🚀 JOB SEARCH - SAAS COMPANIES',
  deepLink: 'obsidian://open?vault=V&file=board',
  objectives: [
    { id: 'q1:obj:0', title: 'Submit application', completed: false },
    { id: 'q1:obj:1', title: 'Send follow-up', completed: true },
  ],
};

describe('QuestModal', () => {
  test('renders title, category, source attribution, objectives', () => {
    render(<QuestModal quest={sampleQuest} onClose={() => {}} onComplete={() => {}} />);
    expect(screen.getByText('Apply to Vercel')).toBeInTheDocument();
    expect(screen.getByText(/Job Hunt/)).toBeInTheDocument();
    expect(screen.getByText(/JOB SEARCH - SAAS/)).toBeInTheDocument();
    expect(screen.getByText('Submit application')).toBeInTheDocument();
    expect(screen.getByText('Send follow-up')).toBeInTheDocument();
  });

  test('calls onComplete when Mark Complete clicked', () => {
    const onComplete = vi.fn();
    render(<QuestModal quest={sampleQuest} onClose={() => {}} onComplete={onComplete} />);
    fireEvent.click(screen.getByRole('button', { name: /mark complete/i }));
    expect(onComplete).toHaveBeenCalledWith(sampleQuest);
  });

  test('"Open in Obsidian" anchor points to deepLink', () => {
    render(<QuestModal quest={sampleQuest} onClose={() => {}} onComplete={() => {}} />);
    const link = screen.getByRole('link', { name: /open in obsidian/i });
    expect(link).toHaveAttribute('href', sampleQuest.deepLink);
  });

  test('Escape key closes modal', () => {
    const onClose = vi.fn();
    render(<QuestModal quest={sampleQuest} onClose={onClose} onComplete={() => {}} />);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm test --workspace=client
```

Expected: FAIL.

- [ ] **Step 3: Implement `client/src/components/QuestModal.jsx`**

```jsx
import { useEffect } from 'react';
import { XpBadge } from './XpBadge.jsx';

export function QuestModal({ quest, onClose, onComplete }) {
  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 bg-hud-bg/80 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-hud-surface border border-hud-accent max-w-lg w-full p-5 relative"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute top-2 right-2 text-hud-border hover:text-hud-accent"
        >
          ✕
        </button>

        <div className="flex items-start justify-between gap-3 mb-3">
          <div>
            <h2 className="text-lg font-bold text-hud-accent">{quest.title}</h2>
            <p className="text-xs uppercase tracking-widest opacity-70 mt-1">
              {quest.category}
            </p>
          </div>
          <XpBadge value={quest.xp} xpSource={quest.xpSource} />
        </div>

        {quest.objectives?.length > 0 && (
          <div className="my-4">
            <p className="text-xs uppercase tracking-widest opacity-70 mb-2">Objectives</p>
            <ul className="space-y-1">
              {quest.objectives.map(obj => (
                <li key={obj.id} className="text-sm flex items-center gap-2">
                  <span aria-hidden>{obj.completed ? '☑' : '☐'}</span>
                  <span className={obj.completed ? 'line-through opacity-60' : ''}>
                    {obj.title}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <p className="text-[10px] uppercase tracking-widest opacity-60 mb-4">
          Source: Obsidian → {quest.rawLane}
        </p>

        <div className="flex gap-2 mt-4">
          <button
            type="button"
            onClick={() => onComplete(quest)}
            className="flex-1 px-3 py-2 bg-hud-accent text-hud-bg font-bold uppercase tracking-widest text-xs hover:brightness-110"
          >
            ▣ Mark Complete
          </button>
          <a
            href={quest.deepLink}
            target="_blank"
            rel="noreferrer"
            className="flex-1 px-3 py-2 border border-hud-border text-hud-accent text-center text-xs uppercase tracking-widest hover:border-hud-accent"
          >
            ↗ Open in Obsidian
          </a>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run tests**

```bash
npm test --workspace=client
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add client/src/components/QuestModal.jsx client/src/tests/QuestModal.test.jsx
git commit -m "feat(client): QuestModal with mark complete + open in obsidian actions"
```

---

## Phase 15: Frontend — Layout Components

### Task 15.1: HeaderHUD component

**Files:**
- Create: `client/src/components/HeaderHUD.jsx`

- [ ] **Step 1: Implement (compositional — tested via App-level smoke later)**

Create `client/src/components/HeaderHUD.jsx`:

```jsx
import { ProgressBar } from './ProgressBar.jsx';
import { StreakBadge } from './StreakBadge.jsx';
import { ShowCompletedToggle } from './ShowCompletedToggle.jsx';
import { SyncIndicator } from './SyncIndicator.jsx';

export function HeaderHUD({ history, lastSyncAt, onRefresh, showCompleted, onToggleCompleted }) {
  const useRolling = history?.useRollingAvg;
  const dailyTarget = useRolling ? (history.rollingAvg7Day?.daily || 1) : (history?.today?.target || 50);
  const weeklyTarget = useRolling ? (history.rollingAvg7Day?.weekly || 1) : (history?.week?.target || 250);

  return (
    <header className="sticky top-0 z-40 bg-hud-bg border-b border-hud-border p-4">
      <div className="flex items-center justify-between mb-3">
        <h1 className="text-xl font-bold tracking-widest text-hud-accent glow">
          ◆ QUEST DASHBOARD
        </h1>
        <div className="flex items-center gap-3">
          <SyncIndicator lastSyncAt={lastSyncAt} onRefresh={onRefresh} />
          <ShowCompletedToggle show={showCompleted} onToggle={onToggleCompleted} />
        </div>
      </div>

      <div className="space-y-2">
        <ProgressBar
          label="Daily"
          current={history?.today?.xp ?? 0}
          target={dailyTarget}
          ambitionTarget={useRolling ? history?.today?.target : null}
          size="lg"
        />
        <ProgressBar
          label="Weekly"
          current={history?.week?.xp ?? 0}
          target={weeklyTarget}
          ambitionTarget={useRolling ? history?.week?.target : null}
          size="sm"
        />
      </div>

      <div className="mt-2 flex items-center gap-4 text-xs">
        <StreakBadge days={history?.streak ?? 0} />
        {useRolling && (
          <span className="opacity-70">
            ↑ Avg: {history.rollingAvg7Day.daily} XP/day
          </span>
        )}
      </div>
    </header>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add client/src/components/HeaderHUD.jsx
git commit -m "feat(client): HeaderHUD with progress bars, streak, sync indicator"
```

---

### Task 15.2: CategorySection component

**Files:**
- Create: `client/src/components/CategorySection.jsx`

- [ ] **Step 1: Implement**

Create `client/src/components/CategorySection.jsx`:

```jsx
import { QuestCard } from './QuestCard.jsx';
import { CompletedQuestCard } from './CompletedQuestCard.jsx';

export function CategorySection({ category, quests, onQuestClick, featured = false, dimmed = false }) {
  const active = quests.filter(q => !q.completed);
  const completed = quests.filter(q => q.completed);
  const allHidden = quests.length === 0;
  if (allHidden) return null;

  return (
    <section className={`mb-6 ${dimmed ? 'opacity-60' : ''}`}>
      <div className={`flex items-baseline justify-between mb-2 ${featured ? 'border-b border-hud-accent pb-1' : ''}`}>
        <h2 className={`text-sm uppercase tracking-widest ${featured ? 'text-hud-accent glow' : 'text-hud-accent/80'}`}>
          ▣ {category}
        </h2>
        <span className="text-xs opacity-70">
          {active.length} active{completed.length > 0 ? ` · ${completed.length} done` : ''}
        </span>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {active.map(q => (
          <QuestCard key={q.id} quest={q} onClick={onQuestClick} />
        ))}
        {completed.map(q => (
          <CompletedQuestCard key={q.id} quest={q} />
        ))}
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add client/src/components/CategorySection.jsx
git commit -m "feat(client): CategorySection rendering active + completed quests"
```

---

### Task 15.3: Wire App.jsx

- [ ] **Step 1: Replace `client/src/App.jsx`**

```jsx
import { useState, useMemo } from 'react';
import { useQuests } from './hooks/useQuests.js';
import { useHistory } from './hooks/useHistory.js';
import { useShowCompleted } from './hooks/useShowCompleted.js';
import { HeaderHUD } from './components/HeaderHUD.jsx';
import { CategorySection } from './components/CategorySection.jsx';
import { QuestModal } from './components/QuestModal.jsx';
import { postComplete } from './lib/api.js';

export default function App() {
  const { quests, categories, meta, loading, error, refetch } = useQuests();
  const { history, refetch: refetchHistory } = useHistory();
  const { show: showCompleted, toggle: toggleCompleted } = useShowCompleted();
  const [selectedQuest, setSelectedQuest] = useState(null);
  const [toast, setToast] = useState(null);

  const visibleQuests = useMemo(
    () => (showCompleted ? quests : quests.filter(q => !q.completed)),
    [quests, showCompleted]
  );

  const byCategory = useMemo(() => {
    const map = new Map();
    for (const cat of categories) map.set(cat, []);
    for (const q of visibleQuests) {
      if (!map.has(q.category)) map.set(q.category, []);
      map.get(q.category).push(q);
    }
    return map;
  }, [categories, visibleQuests]);

  const handleComplete = async (quest) => {
    try {
      await postComplete(quest.id);
      setSelectedQuest(null);
      setToast({ kind: 'success', message: `+${quest.xp} XP — ${quest.title}` });
      await Promise.all([refetch(), refetchHistory()]);
      setTimeout(() => setToast(null), 2500);
    } catch (err) {
      if (err.code === 'CONFLICT') {
        setSelectedQuest(null);
        setToast({ kind: 'warn', message: 'Quest changed in source — refreshing…' });
        await refetch();
        setTimeout(() => setToast(null), 2500);
      } else {
        setToast({ kind: 'error', message: `Error: ${err.message}` });
      }
    }
  };

  if (loading && quests.length === 0) {
    return <div className="p-8 text-hud-accent">INITIALIZING…</div>;
  }

  if (error && quests.length === 0) {
    return (
      <div className="p-8">
        <p className="text-hud-warn">SYNC FAILURE: {error.message}</p>
        <button onClick={refetch} className="mt-4 px-3 py-2 border border-hud-accent text-hud-accent">RETRY</button>
      </div>
    );
  }

  if (visibleQuests.length === 0) {
    return (
      <>
        <HeaderHUD
          history={history}
          lastSyncAt={meta?.lastSyncAt}
          onRefresh={refetch}
          showCompleted={showCompleted}
          onToggleCompleted={toggleCompleted}
        />
        <div className="p-8 text-center text-hud-accent glow tracking-widest">
          ALL QUESTS COMPLETE — STANDBY FOR NEW OBJECTIVES
        </div>
      </>
    );
  }

  return (
    <>
      <HeaderHUD
        history={history}
        lastSyncAt={meta?.lastSyncAt}
        onRefresh={refetch}
        showCompleted={showCompleted}
        onToggleCompleted={toggleCompleted}
      />

      {meta?.sources?.some(s => s.status === 'error') && (
        <div className="bg-hud-warn/20 border-y border-hud-warn px-4 py-2 text-xs text-hud-warn">
          ⚠ SYNC FAILURE — one or more sources unreachable
        </div>
      )}

      <main className="p-4 max-w-7xl mx-auto">
        {[...byCategory.entries()].map(([cat, list]) => (
          <CategorySection
            key={cat}
            category={cat}
            quests={list}
            onQuestClick={setSelectedQuest}
            featured={cat === 'Daily Quests'}
            dimmed={cat === 'Side Quests'}
          />
        ))}
      </main>

      {selectedQuest && (
        <QuestModal
          quest={selectedQuest}
          onClose={() => setSelectedQuest(null)}
          onComplete={handleComplete}
        />
      )}

      {toast && (
        <div className={`fixed bottom-4 right-4 z-50 px-4 py-2 border ${
          toast.kind === 'success' ? 'border-hud-success text-hud-success' :
          toast.kind === 'warn' ? 'border-hud-xp text-hud-xp' :
          'border-hud-warn text-hud-warn'
        } bg-hud-surface`}>
          {toast.message}
        </div>
      )}
    </>
  );
}
```

- [ ] **Step 2: Run all client tests**

```bash
npm test --workspace=client
```

Expected: all passing.

- [ ] **Step 3: Commit**

```bash
git add client/src/App.jsx
git commit -m "feat(client): wire App with hooks, modal, toasts, error + empty states"
```

---

## Phase 16: First-Run Backfill

### Task 16.1: Implement historical backfill from ✅ markers

**Files:**
- Create: `server/core/backfill.js`
- Create: `server/tests/backfill.test.js`

- [ ] **Step 1: Write failing test**

Create `server/tests/backfill.test.js`:

```js
import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';
import { ObsidianAdapter } from '../adapters/ObsidianAdapter.js';
import { createHistoryStore } from '../core/historyStore.js';
import { backfillIfNeeded } from '../core/backfill.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const FIXTURE = path.join(__dirname, 'fixtures', 'sample-board.md');

let tmpDir;
let workingFile;
let historyFile;
let markerDir;

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'qd-backfill-'));
  workingFile = path.join(tmpDir, 'board.md');
  historyFile = path.join(tmpDir, 'data', 'history.jsonl');
  markerDir = path.join(tmpDir, 'data');
  await fs.writeFile(workingFile, await fs.readFile(FIXTURE, 'utf8'));
});

afterEach(async () => {
  await fs.rm(tmpDir, { recursive: true, force: true });
});

describe('backfillIfNeeded', () => {
  test('first run populates history from ✅ markers', async () => {
    const adapter = new ObsidianAdapter({ file: workingFile, vault: 'V' });
    const history = createHistoryStore(historyFile);
    await backfillIfNeeded(adapter, history, markerDir);
    const events = await history.readAll();
    // sample-board.md has 'Completed task ✅ 2026-05-15' (visible) + 'Old thing ✅ 2026-01-01' (Archive, hidden)
    // Backfill includes ALL completions regardless of hidden lanes (history is permanent record)
    expect(events.length).toBeGreaterThanOrEqual(1);
    const completed = events.find(e => e.title === 'Completed task');
    expect(completed).toBeDefined();
  });

  test('subsequent runs skip backfill', async () => {
    const adapter = new ObsidianAdapter({ file: workingFile, vault: 'V' });
    const history = createHistoryStore(historyFile);
    await backfillIfNeeded(adapter, history, markerDir);
    const firstCount = (await history.readAll()).length;
    await backfillIfNeeded(adapter, history, markerDir);
    const secondCount = (await history.readAll()).length;
    expect(secondCount).toBe(firstCount);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm test --workspace=server
```

Expected: FAIL.

- [ ] **Step 3: Implement `server/core/backfill.js`**

```js
import { promises as fs } from 'fs';
import path from 'path';

export async function backfillIfNeeded(adapter, history, markerDir) {
  const markerPath = path.join(markerDir, `.backfilled-${adapter.getId()}`);
  try {
    await fs.access(markerPath);
    return; // already backfilled
  } catch {
    // not yet backfilled — proceed
  }

  const quests = await adapter.listQuests();
  const events = [];
  const collect = (q) => {
    if (q.completed && q.completedAt) {
      events.push({
        ts: q.completedAt,
        questId: q.id,
        xp: q.xp || 0,
        source: q.sourceId,
        title: q.title,
      });
    }
    (q.objectives || []).forEach(collect);
  };
  quests.forEach(collect);

  if (events.length > 0) await history.appendBatch(events);

  await fs.mkdir(markerDir, { recursive: true });
  await fs.writeFile(markerPath, new Date().toISOString());
}
```

- [ ] **Step 4: Run tests**

```bash
npm test --workspace=server
```

Expected: PASS.

- [ ] **Step 5: Wire backfill into `server/index.js`**

In `server/index.js`, after the `aggregator` is created and before mounting routes, add:

```js
import { backfillIfNeeded } from './core/backfill.js';

// ... after `const aggregator = createAggregator(adapters, history);`
const dataDir = path.join(PROJECT_ROOT, 'data');
for (const adapter of adapters) {
  await backfillIfNeeded(adapter, history, dataDir);
}
```

- [ ] **Step 6: Commit**

```bash
git add server/core/backfill.js server/tests/backfill.test.js server/index.js
git commit -m "feat(core): first-run backfill from ✅ markers"
```

---

## Phase 17: End-to-End Smoke Test + README

### Task 17.1: Manual end-to-end smoke test

- [ ] **Step 1: Ensure config points to real kanban**

Edit `config/sources.json` to point to:

```json
{
  "sources": [
    {
      "id": "obsidian",
      "adapter": "ObsidianAdapter",
      "config": {
        "file": "/absolute/path/to/your/vault/Tasks/your-board.md",
        "vault": "YourVaultName"
      },
      "pollIntervalSec": 60
    }
  ]
}
```

- [ ] **Step 2: Make a backup of the real kanban (CRITICAL before first write test)**

```bash
cp "/absolute/path/to/your/vault/Tasks/your-board.md" \
   "/absolute/path/to/your/vault/Tasks/your-board.md.bak.pre-qd-$(date +%Y%m%d-%H%M%S)"
```

- [ ] **Step 3: Run dev mode**

```bash
npm run dev
```

Expected:
- Server log: `Quest Dashboard API listening on http://localhost:3000`
- Vite log: `Local: http://localhost:5173/`

- [ ] **Step 4: Open `http://localhost:5173` in browser**

Verify:
- Header HUD renders with daily/weekly bars
- Categories appear: Daily Quests, Job Hunt, Personal Dev, Project B, Project A, Side Quests
- "DONE - REVIEW" and "Archive" quests are NOT visible
- Quest cards show XP badges + flags
- Clicking a card opens the modal
- Modal "Open in Obsidian" link works (opens Obsidian)

- [ ] **Step 5: Test bidirectional write**

- Click "Mark Complete" on a low-importance test quest
- Verify: HUD XP bar animates upward
- Verify: kanban file now contains `- [x] <title> ✅ <today>` at the expected line
- Open kanban in Obsidian — confirm the change is reflected

- [ ] **Step 6: Test toggle**

- Click "Show Completed" — completed quests appear dimmed/struck
- Reload page — toggle state persists

- [ ] **Step 7: Verify XP history**

```bash
cat data/xp-history.jsonl | head
```

Expected: backfilled entries from existing ✅ markers + the new completion you just made.

- [ ] **Step 8: Stop server**

Ctrl+C in the terminal running `npm run dev`.

---

### Task 17.2: Write usage README

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Replace `README.md` with full usage instructions**

```markdown
# Quest Dashboard

A personal RPG-styled task dashboard. Reads tasks from an Obsidian kanban file, presents them as cyberpunk-HUD-styled quests with XP scoring + daily/weekly progress bars. Supports bidirectional sync (marking a quest complete in the dashboard writes back to the kanban).

See [`docs/`](docs/) for full design (PRD, spec, architecture, user stories, implementation plan).

## Quick start

```bash
# 1. Install
nvm use            # Node 20+
npm install

# 2. Configure
mkdir -p config data
cp config/sources.example.json config/sources.json
cp config/targets.example.json config/targets.json
# Edit config/sources.json to point to your kanban file

# 3. Run (dev mode)
npm run dev
# Open http://localhost:5173

# OR production mode (single port, no Vite dev server)
npm run build
npm start
# Open http://localhost:3000
```

## Features (v1)

- Reads tasks from an Obsidian kanban-plugin board
- Quests categorized (Daily, Job Hunt, Personal Dev, Project B, Project A, Side Quests)
- Auto XP scoring + `#xpN` tag override
- Cyberpunk HUD UI with daily/weekly progress bars
- Bidirectional sync: "Mark Complete" writes back to the kanban
- 60s background polling + manual refresh
- Show/hide completed toggle
- First-run backfill from existing `✅ YYYY-MM-DD` markers

## Config files

| File | Purpose |
|---|---|
| `config/sources.json` | Adapter activation + per-source config (kanban file path, vault) |
| `config/targets.json` | Daily/weekly XP goals |
| `config/categoryMap.json` (optional) | Override default category mapping rules |
| `data/xp-history.jsonl` | Append-only completion log — auto-managed |

## Testing

```bash
npm test                  # all workspaces
npm test --workspace=server
npm test --workspace=client
```

## Roadmap

- **v1** ✓ Obsidian-only MVP
- **v2** Google Tasks integration + live file watching
- **v3** Google Calendar (events as timeboxed quests)

See [`docs/PRD.md`](docs/PRD.md) for full roadmap detail.
```

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "docs: usage README with quick-start, config, testing"
```

---

### Task 17.3: Final verification

- [ ] **Step 1: Run all tests one more time**

```bash
npm test
```

Expected: all tests pass across both workspaces.

- [ ] **Step 2: Run production build**

```bash
npm run build
```

Expected: Vite builds `client/dist/` with no errors.

- [ ] **Step 3: Start in production mode**

```bash
npm start
```

Open `http://localhost:3000` — verify the dashboard loads and functions identically to dev mode.

- [ ] **Step 4: Tag v1.0.0**

```bash
git tag v1.0.0
git log --oneline | head -20
```

Expected: tag exists, recent commits visible.

---

## Self-Review Checklist

After completing all phases, verify:

- [ ] **Spec coverage**: every section in [SPEC.md](SPEC.md) maps to at least one task
  - §1 Quest Schema → Task 1.1
  - §2 XP Scoring → Tasks 2.1-2.3
  - §3 Category Mapping → Task 3.1
  - §4 Sorting → Task 9.1
  - §5 Progress Bar Math → Tasks 4.2 + 10.3
  - §6 XP History Storage → Tasks 4.1-4.2 + 16.1
  - §7 Subtask Behavior → Tasks 6.2 + 8.1 + 14.3
  - §8 Modal Actions → Task 14.3
  - §9 Show/Hide Completed → Task 12.3 + 15.3
  - §10 HTTP API → Tasks 10.1-10.4
  - §11 Config Files → Task 11.1
  - §12 Edge Cases → covered across adapter, aggregator, route tests
  - §13 Data Validation → covered in parser + adapter

- [ ] **All tests passing** (across both server and client workspaces)
- [ ] **End-to-end manual smoke test completed** (Task 17.1)
- [ ] **No `TODO`, `TBD`, or placeholder strings remain in code**

If any check fails, address it before declaring v1 complete.
