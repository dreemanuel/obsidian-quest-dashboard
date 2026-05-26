# Quest Dashboard v1.2 — Onboarding Flow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a first-run + reusable Settings onboarding wizard that lets users pick kanban files via a custom server-side file/folder browser, scan a vault for auto-detected boards, review a checklist, and confirm — replacing the v1 requirement to hand-edit `config/sources.json`.

**Architecture:** Backend gets four new `/api/setup/*` endpoints (status, browse, scan-vault, save-sources) plus a path-security guard, an atomic config writer, and a hot-reload `replaceAdapters` on the aggregator. Frontend gets a new `OnboardingFlow` wizard with a `useReducer` state machine, conditional-rendered at the App level when `setupNeeded` is true OR Settings was clicked.

**Tech Stack:** Same as v1 + v1.1 — Node + Express + Vitest backend, Vite + React + Tailwind + Testing Library frontend.

**Companion docs:** [SPEC-v1.2-onboarding.md](SPEC-v1.2-onboarding.md), [SPEC.md](SPEC.md), [ARCHITECTURE.md](ARCHITECTURE.md)

---

## Phase 1: Backend prerequisites

### Task 1: `pathGuard.assertPathSafe`

**Files:**
- Create: `server/core/pathGuard.js`
- Create: `server/tests/pathGuard.test.js`

- [ ] **Step 1: Write failing tests**

Create `server/tests/pathGuard.test.js`:

```js
import { describe, test, expect, beforeAll, afterAll } from 'vitest';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';
import { assertPathSafe } from '../core/pathGuard.js';

const HOME = os.homedir();

describe('assertPathSafe', () => {
  test('accepts a path inside HOME', async () => {
    const inside = path.join(HOME, 'Documents');
    const result = await assertPathSafe(inside);
    expect(result).toBe(path.resolve(inside));
  });

  test('rejects a path outside HOME', async () => {
    await expect(assertPathSafe('/etc/passwd')).rejects.toMatchObject({ code: 'PATH_OUT_OF_BOUNDS' });
  });

  test('rejects path containing .. segments after resolve escape', async () => {
    const escape = path.join(HOME, '..', '..', 'etc');
    await expect(assertPathSafe(escape)).rejects.toMatchObject({ code: 'PATH_OUT_OF_BOUNDS' });
  });

  test('resolves symlink before bounds check', async () => {
    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'pg-'));
    const sym = path.join(HOME, `pg-sym-${Date.now()}`);
    try {
      await fs.symlink(tmp, sym);
      await expect(assertPathSafe(sym)).rejects.toMatchObject({ code: 'PATH_OUT_OF_BOUNDS' });
    } finally {
      await fs.unlink(sym).catch(() => {});
      await fs.rm(tmp, { recursive: true, force: true });
    }
  });

  test('rejects non-existent path with PATH_NOT_FOUND', async () => {
    const missing = path.join(HOME, `does-not-exist-${Date.now()}`);
    await expect(assertPathSafe(missing)).rejects.toMatchObject({ code: 'PATH_NOT_FOUND' });
  });
});
```

- [ ] **Step 2: Run tests — verify RED**

```bash
npm test --workspace=server
```

Expected: pathGuard tests fail with module-not-found. Prior 95 tests pass.

- [ ] **Step 3: Implement `server/core/pathGuard.js`**

```js
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';

/**
 * Canonicalize an input path, then assert it lies inside the user's home dir.
 * Resolves symlinks before the bounds check.
 *
 * Throws:
 *  - { code: 'PATH_NOT_FOUND' } if the path doesn't exist
 *  - { code: 'PATH_OUT_OF_BOUNDS' } if the canonical path escapes $HOME
 *  - { code: 'PATH_INVALID' } for other I/O errors during resolution
 *
 * Returns: the canonical absolute path on success.
 */
export async function assertPathSafe(input) {
  const home = os.homedir();
  let canonical;
  try {
    const resolved = path.resolve(input);
    canonical = await fs.realpath(resolved);
  } catch (err) {
    if (err.code === 'ENOENT') {
      const e = new Error(`PATH_NOT_FOUND: ${input}`);
      e.code = 'PATH_NOT_FOUND';
      throw e;
    }
    const e = new Error(`PATH_INVALID: ${err.message}`);
    e.code = 'PATH_INVALID';
    throw e;
  }
  const homeCanonical = await fs.realpath(home);
  const rel = path.relative(homeCanonical, canonical);
  if (rel.startsWith('..') || path.isAbsolute(rel)) {
    const e = new Error(`PATH_OUT_OF_BOUNDS: ${canonical}`);
    e.code = 'PATH_OUT_OF_BOUNDS';
    throw e;
  }
  return canonical;
}
```

- [ ] **Step 4: Run tests — verify GREEN**

```bash
npm test --workspace=server
```

Expected: 100 tests pass (95 prior + 5 new).

- [ ] **Step 5: Commit**

```bash
git add server/core/pathGuard.js server/tests/pathGuard.test.js
git commit -m "feat(core): pathGuard.assertPathSafe with home-dir containment + symlink resolution"
```

---

### Task 2: `configWriter.writeSourcesConfig`

**Files:**
- Create: `server/core/configWriter.js`
- Create: `server/tests/configWriter.test.js`

- [ ] **Step 1: Write failing tests**

Create `server/tests/configWriter.test.js`:

```js
import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';
import { writeSourcesConfig } from '../core/configWriter.js';

let rootDir;

beforeEach(async () => {
  rootDir = await fs.mkdtemp(path.join(os.tmpdir(), 'cw-'));
});

afterEach(async () => {
  await fs.rm(rootDir, { recursive: true, force: true });
});

describe('writeSourcesConfig', () => {
  test('creates config/sources.json with the given sources array', async () => {
    const sources = [
      { id: 'obsidian', adapter: 'ObsidianAdapter', config: { file: '/x/y.md', vault: 'V' }, pollIntervalSec: 60 },
    ];
    await writeSourcesConfig(rootDir, sources);
    const raw = await fs.readFile(path.join(rootDir, 'config', 'sources.json'), 'utf8');
    expect(JSON.parse(raw)).toEqual({ sources });
  });

  test('overwrites existing config atomically (no .tmp file remains)', async () => {
    const configDir = path.join(rootDir, 'config');
    await fs.mkdir(configDir, { recursive: true });
    await fs.writeFile(path.join(configDir, 'sources.json'), JSON.stringify({ sources: [{ id: 'old' }] }));
    await writeSourcesConfig(rootDir, [{ id: 'new', adapter: 'X', config: {}, pollIntervalSec: 60 }]);
    const raw = await fs.readFile(path.join(configDir, 'sources.json'), 'utf8');
    expect(JSON.parse(raw).sources[0].id).toBe('new');
    const entries = await fs.readdir(configDir);
    expect(entries.filter(e => e.endsWith('.tmp'))).toHaveLength(0);
  });

  test('creates config/ directory if missing', async () => {
    await writeSourcesConfig(rootDir, []);
    const stat = await fs.stat(path.join(rootDir, 'config'));
    expect(stat.isDirectory()).toBe(true);
  });

  test('writes empty sources array cleanly', async () => {
    await writeSourcesConfig(rootDir, []);
    const raw = await fs.readFile(path.join(rootDir, 'config', 'sources.json'), 'utf8');
    expect(JSON.parse(raw)).toEqual({ sources: [] });
  });
});
```

- [ ] **Step 2: Run tests — verify RED**

```bash
npm test --workspace=server
```

Expected: configWriter tests fail with module-not-found.

- [ ] **Step 3: Implement `server/core/configWriter.js`**

```js
import { promises as fs } from 'fs';
import path from 'path';

/**
 * Atomically write the sources config to `<rootDir>/config/sources.json`.
 * Writes to `<file>.tmp` first, then renames into place — so a crash mid-write
 * leaves the original config untouched.
 *
 * @param {string} rootDir Project root (parent of config/)
 * @param {Array} sources Array of source descriptors
 */
export async function writeSourcesConfig(rootDir, sources) {
  const configDir = path.join(rootDir, 'config');
  await fs.mkdir(configDir, { recursive: true });
  const target = path.join(configDir, 'sources.json');
  const tmp = `${target}.tmp`;
  const payload = JSON.stringify({ sources }, null, 2) + '\n';
  await fs.writeFile(tmp, payload, 'utf8');
  await fs.rename(tmp, target);
}
```

- [ ] **Step 4: Run tests — verify GREEN**

```bash
npm test --workspace=server
```

Expected: 104 tests pass (100 + 4 new).

- [ ] **Step 5: Commit**

```bash
git add server/core/configWriter.js server/tests/configWriter.test.js
git commit -m "feat(core): configWriter.writeSourcesConfig with atomic .tmp + rename"
```

---

### Task 3: `configLoader` resilience for missing sources.json

**Files:**
- Modify: `server/core/configLoader.js`
- Create: `server/tests/configLoader.test.js`

- [ ] **Step 1: Write failing tests**

Create `server/tests/configLoader.test.js`:

```js
import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';
import { loadConfig } from '../core/configLoader.js';

let rootDir;

beforeEach(async () => {
  rootDir = await fs.mkdtemp(path.join(os.tmpdir(), 'cl-'));
});

afterEach(async () => {
  await fs.rm(rootDir, { recursive: true, force: true });
});

describe('loadConfig — graceful missing config', () => {
  test('returns empty sources when sources.json is missing', async () => {
    const { sources, targets } = await loadConfig(rootDir);
    expect(sources).toEqual({ sources: [] });
    expect(targets).toEqual({ daily: 50, weekly: 250 });
  });

  test('returns parsed sources when sources.json exists', async () => {
    const configDir = path.join(rootDir, 'config');
    await fs.mkdir(configDir, { recursive: true });
    const payload = { sources: [{ id: 'obsidian', adapter: 'X', config: {}, pollIntervalSec: 60 }] };
    await fs.writeFile(path.join(configDir, 'sources.json'), JSON.stringify(payload));
    const { sources } = await loadConfig(rootDir);
    expect(sources).toEqual(payload);
  });

  test('still throws on malformed JSON in sources.json', async () => {
    const configDir = path.join(rootDir, 'config');
    await fs.mkdir(configDir, { recursive: true });
    await fs.writeFile(path.join(configDir, 'sources.json'), '{not valid json');
    await expect(loadConfig(rootDir)).rejects.toThrow();
  });
});
```

- [ ] **Step 2: Run tests — verify RED**

```bash
npm test --workspace=server
```

Expected: "returns empty sources when sources.json is missing" fails (current `loadConfig` throws). Other two pass already.

- [ ] **Step 3: Modify `server/core/configLoader.js`**

Replace the body of the file with:

```js
import { promises as fs } from 'fs';
import path from 'path';

export async function loadConfig(rootDir) {
  const configDir = path.join(rootDir, 'config');
  const sourcesPath = path.join(configDir, 'sources.json');
  const targetsPath = path.join(configDir, 'targets.json');

  const [sources, targets] = await Promise.all([
    readJsonOrDefault(sourcesPath, { sources: [] }),
    readJsonOrDefault(targetsPath, { daily: 50, weekly: 250 }),
  ]);

  return { sources, targets };
}

async function readJsonOrDefault(filePath, defaultValue) {
  try {
    const raw = await fs.readFile(filePath, 'utf8');
    return JSON.parse(raw);
  } catch (err) {
    if (err.code === 'ENOENT') return defaultValue;
    throw err;
  }
}
```

This drops the `readJsonOrThrow` helper entirely — both sources and targets now use the same default-on-missing pattern. Malformed JSON still throws (the `JSON.parse` error isn't ENOENT).

- [ ] **Step 4: Run tests — verify GREEN**

```bash
npm test --workspace=server
```

Expected: 107 tests pass (104 + 3 new).

- [ ] **Step 5: Commit**

```bash
git add server/core/configLoader.js server/tests/configLoader.test.js
git commit -m "feat(core): configLoader returns empty sources when sources.json missing"
```

---

### Task 4: `aggregator.replaceAdapters`

**Files:**
- Modify: `server/core/aggregator.js`
- Modify: `server/tests/aggregator.test.js`

- [ ] **Step 1: Append failing test**

Append to `server/tests/aggregator.test.js`:

```js
describe('aggregator — replaceAdapters', () => {
  test('replaces the adapter list and clears completion-diff state', async () => {
    const adapter = new ObsidianAdapter({ file: workingFile, vault: 'TestVault' });
    const history = createHistoryStore(historyFile);
    const agg = createAggregator([adapter], history);

    // First call seeds the snapshot
    const r1 = await agg.collectAll();
    expect(r1.quests.length).toBeGreaterThan(0);

    // Replace with empty list
    agg.replaceAdapters([]);
    const r2 = await agg.collectAll();
    expect(r2.quests).toEqual([]);
    expect(r2.meta.sources).toEqual([]);

    // Externally mark a quest complete in the original file (just to prove
    // the snapshot was cleared — putting the original adapter BACK should
    // not fire a spurious completion-diff event for an unrelated reason).
    let raw = await fs.readFile(workingFile, 'utf8');
    raw = raw.replace('- [ ] First today task', '- [x] First today task ✅ 2026-05-27');
    await fs.writeFile(workingFile, raw);

    // Put adapter back; first call seeds, no event yet
    agg.replaceAdapters([adapter]);
    await agg.collectAll();
    const eventsAfter = await history.readAll();
    expect(eventsAfter).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run tests — verify RED**

```bash
npm test --workspace=server
```

Expected: new test fails — `agg.replaceAdapters is not a function`.

- [ ] **Step 3: Modify `server/core/aggregator.js`**

Find the `createAggregator` function and add a `replaceAdapters` method to the returned object. Replace the `return { collectAll };` line at the end of the factory function with:

```js
  function replaceAdapters(newAdapters) {
    adapters = newAdapters;
    previousSnapshot = null;
  }

  return { collectAll, replaceAdapters };
```

Also change the parameter declaration at the top from `const` to `let` so it can be reassigned:

```js
export function createAggregator(adapters, historyStore) {
```

becomes:

```js
export function createAggregator(initialAdapters, historyStore) {
  let adapters = initialAdapters;
```

Update the rest of the function body to reference `adapters` (the let binding) — should already be the case since the function references `adapters` directly. Verify the closure captures the let-binding properly.

- [ ] **Step 4: Run tests — verify GREEN**

```bash
npm test --workspace=server
```

Expected: 108 tests pass (107 + 1 new).

- [ ] **Step 5: Commit**

```bash
git add server/core/aggregator.js server/tests/aggregator.test.js
git commit -m "feat(core): aggregator.replaceAdapters for hot-reload after config change"
```

---

## Phase 2: Vault scanner

### Task 5: `vaultScanner` — recursive walk + kanban detection

**Files:**
- Create: `server/core/vaultScanner.js`
- Create: `server/tests/vaultScanner.test.js`
- Create: `server/tests/fixtures/vault-tree/` (test fixture directory)

- [ ] **Step 1: Create the test fixture vault tree**

Run these commands from the project root:

```bash
mkdir -p server/tests/fixtures/vault-tree/.obsidian
mkdir -p server/tests/fixtures/vault-tree/Tasks
mkdir -p server/tests/fixtures/vault-tree/Notes
mkdir -p server/tests/fixtures/vault-tree/.hidden
mkdir -p server/tests/fixtures/vault-tree/node_modules
echo "{}" > server/tests/fixtures/vault-tree/.obsidian/config.json

cat > server/tests/fixtures/vault-tree/Tasks/board.md <<'EOF'
---

kanban-plugin: board

---

## A

- [ ] task one
EOF

cat > server/tests/fixtures/vault-tree/Tasks/other-board.md <<'EOF'
---

kanban-plugin: board

---

## B

- [ ] task two
EOF

cat > server/tests/fixtures/vault-tree/Notes/regular.md <<'EOF'
# Just a regular note

Not a kanban board.
EOF

cat > server/tests/fixtures/vault-tree/.hidden/hidden-board.md <<'EOF'
---

kanban-plugin: board

---

## Hidden

- [ ] should not be scanned
EOF

cat > server/tests/fixtures/vault-tree/node_modules/fake-board.md <<'EOF'
---

kanban-plugin: board

---

## NodeModules

- [ ] should not be scanned
EOF
```

This gives us: 2 valid kanban files (Tasks/board.md, Tasks/other-board.md), 1 regular note (Notes/regular.md), 2 boards that should be EXCLUDED (.hidden/hidden-board.md, node_modules/fake-board.md).

- [ ] **Step 2: Write failing tests**

Create `server/tests/vaultScanner.test.js`:

```js
import { describe, test, expect } from 'vitest';
import path from 'path';
import { fileURLToPath } from 'url';
import { scanVault, inferVaultName, isKanbanFile } from '../core/vaultScanner.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const VAULT = path.join(__dirname, 'fixtures', 'vault-tree');

describe('isKanbanFile', () => {
  test('returns true for a file with kanban-plugin: board frontmatter', async () => {
    expect(await isKanbanFile(path.join(VAULT, 'Tasks', 'board.md'))).toBe(true);
  });
  test('returns false for a regular markdown note', async () => {
    expect(await isKanbanFile(path.join(VAULT, 'Notes', 'regular.md'))).toBe(false);
  });
  test('returns false for a non-existent file', async () => {
    expect(await isKanbanFile(path.join(VAULT, 'nope.md'))).toBe(false);
  });
});

describe('inferVaultName', () => {
  test('returns vault basename when path is the vault root', async () => {
    expect(await inferVaultName(VAULT)).toBe('vault-tree');
  });
  test('returns vault basename when walking up from a nested file', async () => {
    expect(await inferVaultName(path.join(VAULT, 'Tasks', 'board.md'))).toBe('vault-tree');
  });
  test('returns null when no .obsidian/ found on walk-up', async () => {
    const noVault = path.join(__dirname, 'fixtures'); // grandparent of any .obsidian/
    expect(await inferVaultName(noVault)).toBe(null);
  });
});

describe('scanVault', () => {
  test('finds kanban-marker files and skips .obsidian/, hidden, node_modules/', async () => {
    const result = await scanVault(VAULT);
    expect(result.vaultName).toBe('vault-tree');
    expect(result.truncated).toBe(false);
    const titles = result.boards.map(b => b.relativePath).sort();
    expect(titles).toEqual(['Tasks/board.md', 'Tasks/other-board.md']);
  });

  test('returns null vaultName when scanned path has no .obsidian/', async () => {
    const parentOfVault = path.dirname(VAULT);
    const result = await scanVault(parentOfVault);
    // Should still find Tasks/board.md + Tasks/other-board.md inside vault-tree
    // (the vault-tree's .obsidian/ is skipped — only direct .obsidian dirs in the scanned path matter for vaultName detection)
    expect(result.vaultName).toBe(null);
  });

  test('respects soft cap and sets truncated flag', async () => {
    const result = await scanVault(VAULT, { softCap: 1 });
    expect(result.truncated).toBe(true);
    expect(result.boards.length).toBeLessThanOrEqual(1);
  });
});
```

- [ ] **Step 3: Run tests — verify RED**

```bash
npm test --workspace=server
```

Expected: vaultScanner tests fail (module not found).

- [ ] **Step 4: Implement `server/core/vaultScanner.js`**

```js
import { promises as fs } from 'fs';
import path from 'path';

const FRONTMATTER_HEAD_BYTES = 2048;
const KANBAN_MARKER_RE = /^kanban-plugin:\s*board\s*$/m;
const SKIPPED_DIR_NAMES = new Set(['.obsidian', 'node_modules']);
const DEFAULT_SOFT_CAP = 5000;

export async function isKanbanFile(absPath) {
  try {
    const handle = await fs.open(absPath, 'r');
    try {
      const buf = Buffer.alloc(FRONTMATTER_HEAD_BYTES);
      const { bytesRead } = await handle.read(buf, 0, FRONTMATTER_HEAD_BYTES, 0);
      const text = buf.slice(0, bytesRead).toString('utf8');
      return KANBAN_MARKER_RE.test(text);
    } finally {
      await handle.close();
    }
  } catch {
    return false;
  }
}

/**
 * Walk up from a path looking for an ancestor directory that contains a
 * `.obsidian/` subfolder. If found, return that ancestor's basename; else null.
 * If `inputPath` is a file, start the walk from its parent dir.
 */
export async function inferVaultName(inputPath) {
  let dir = inputPath;
  try {
    const stat = await fs.stat(inputPath);
    if (!stat.isDirectory()) dir = path.dirname(inputPath);
  } catch {
    return null;
  }
  // Walk up
  let current = dir;
  while (true) {
    try {
      const obsidianMarker = path.join(current, '.obsidian');
      const markerStat = await fs.stat(obsidianMarker);
      if (markerStat.isDirectory()) return path.basename(current);
    } catch {
      // .obsidian/ not here; continue up
    }
    const parent = path.dirname(current);
    if (parent === current) break; // reached filesystem root
    current = parent;
  }
  return null;
}

/**
 * Recursively walk `rootPath`, returning all kanban-plugin board files found.
 * Skips .obsidian/, hidden dirs (starting with '.'), and node_modules/.
 * Has a soft cap on the number of files SCANNED (not just matched).
 */
export async function scanVault(rootPath, opts = {}) {
  const softCap = opts.softCap ?? DEFAULT_SOFT_CAP;
  const boards = [];
  let filesScanned = 0;
  let truncated = false;

  async function walk(dir) {
    if (truncated) return;
    let entries;
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (truncated) return;
      if (entry.isDirectory()) {
        if (entry.name.startsWith('.')) continue;
        if (SKIPPED_DIR_NAMES.has(entry.name)) continue;
        await walk(path.join(dir, entry.name));
      } else if (entry.isFile() && entry.name.endsWith('.md')) {
        if (filesScanned >= softCap) {
          truncated = true;
          return;
        }
        filesScanned += 1;
        const full = path.join(dir, entry.name);
        if (await isKanbanFile(full)) {
          const inferred = await inferVaultName(full);
          boards.push({
            relativePath: path.relative(rootPath, full),
            fullPath: full,
            inferredVault: inferred,
          });
        }
      }
    }
  }

  await walk(rootPath);

  // Detect vaultName for the scan root: does rootPath/.obsidian/ exist?
  let vaultName = null;
  try {
    const obsidianMarker = path.join(rootPath, '.obsidian');
    const st = await fs.stat(obsidianMarker);
    if (st.isDirectory()) vaultName = path.basename(rootPath);
  } catch {
    // not a vault root
  }

  return { vaultName, boards, truncated, filesScanned };
}
```

- [ ] **Step 5: Run tests — verify GREEN**

```bash
npm test --workspace=server
```

Expected: 117 tests pass (108 + 9 new).

- [ ] **Step 6: Commit**

```bash
git add server/core/vaultScanner.js server/tests/vaultScanner.test.js server/tests/fixtures/vault-tree/
git commit -m "feat(core): vaultScanner with kanban-marker detection + vault inference"
```

---

## Phase 3: Setup HTTP routes

### Task 6: `GET /api/setup/status` route

**Files:**
- Create: `server/routes/setup.js`
- Create: `server/tests/routes-setup.test.js`

- [ ] **Step 1: Write failing test**

Create `server/tests/routes-setup.test.js`:

```js
import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';
import express from 'express';
import request from 'supertest';
import { createSetupRoute } from '../routes/setup.js';
import { ObsidianAdapter } from '../adapters/ObsidianAdapter.js';
import { createAggregator } from '../core/aggregator.js';
import { createHistoryStore } from '../core/historyStore.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const VAULT_FIXTURE = path.join(__dirname, 'fixtures', 'vault-tree');
const BOARD_FIXTURE = path.join(__dirname, 'fixtures', 'sample-board.md');

async function buildAppWithSetup({ initialAdapters = [], sourcesOnDisk = [] } = {}) {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'qd-setup-'));
  if (sourcesOnDisk.length > 0) {
    await fs.mkdir(path.join(tmpDir, 'config'), { recursive: true });
    await fs.writeFile(
      path.join(tmpDir, 'config', 'sources.json'),
      JSON.stringify({ sources: sourcesOnDisk })
    );
  }
  const history = createHistoryStore(path.join(tmpDir, 'data', 'history.jsonl'));
  const aggregator = createAggregator(initialAdapters, history);
  const ADAPTER_REGISTRY = { ObsidianAdapter };
  const app = express();
  app.use(express.json());
  app.use('/api/setup', createSetupRoute({ rootDir: tmpDir, aggregator, adapterRegistry: ADAPTER_REGISTRY }));
  return { app, tmpDir, aggregator, history };
}

describe('GET /api/setup/status', () => {
  test('returns setupNeeded: true when no sources configured', async () => {
    const { app, tmpDir } = await buildAppWithSetup();
    try {
      const res = await request(app).get('/api/setup/status');
      expect(res.status).toBe(200);
      expect(res.body.setupNeeded).toBe(true);
      expect(res.body.sources).toEqual([]);
    } finally {
      await fs.rm(tmpDir, { recursive: true, force: true });
    }
  });

  test('returns setupNeeded: false + sources list when sources configured', async () => {
    const sourcesOnDisk = [
      { id: 'obsidian', adapter: 'ObsidianAdapter', config: { file: BOARD_FIXTURE, vault: 'TestVault' }, pollIntervalSec: 60 },
    ];
    const { app, tmpDir } = await buildAppWithSetup({ sourcesOnDisk });
    try {
      const res = await request(app).get('/api/setup/status');
      expect(res.status).toBe(200);
      expect(res.body.setupNeeded).toBe(false);
      expect(res.body.sources).toHaveLength(1);
      expect(res.body.sources[0].file).toBe(BOARD_FIXTURE);
      expect(res.body.sources[0].vault).toBe('TestVault');
    } finally {
      await fs.rm(tmpDir, { recursive: true, force: true });
    }
  });
});
```

- [ ] **Step 2: Run tests — verify RED**

```bash
npm test --workspace=server
```

Expected: routes-setup tests fail (module not found).

- [ ] **Step 3: Implement initial `server/routes/setup.js`**

```js
import { Router } from 'express';
import path from 'path';
import { promises as fs } from 'fs';

export function createSetupRoute({ rootDir, aggregator, adapterRegistry }) {
  const router = Router();

  router.get('/status', async (req, res, next) => {
    try {
      const sources = await readSourcesFromDisk(rootDir);
      res.json({
        setupNeeded: sources.length === 0,
        sources: sources.map(s => ({
          id: s.id,
          adapter: s.adapter,
          file: s.config.file,
          vault: s.config.vault,
        })),
      });
    } catch (err) {
      next(err);
    }
  });

  return router;
}

async function readSourcesFromDisk(rootDir) {
  const sourcesPath = path.join(rootDir, 'config', 'sources.json');
  try {
    const raw = await fs.readFile(sourcesPath, 'utf8');
    const parsed = JSON.parse(raw);
    return parsed.sources || [];
  } catch (err) {
    if (err.code === 'ENOENT') return [];
    throw err;
  }
}
```

- [ ] **Step 4: Run tests — verify GREEN**

```bash
npm test --workspace=server
```

Expected: 119 tests pass (117 + 2 new).

- [ ] **Step 5: Commit**

```bash
git add server/routes/setup.js server/tests/routes-setup.test.js
git commit -m "feat(routes): GET /api/setup/status"
```

---

### Task 7: `GET /api/setup/browse` route (files + folders modes)

**Files:**
- Modify: `server/routes/setup.js`
- Modify: `server/tests/routes-setup.test.js`

- [ ] **Step 1: Append failing tests**

Append to `server/tests/routes-setup.test.js`:

```js
import os from 'os';

describe('GET /api/setup/browse', () => {
  test('files mode lists subdirs + .md files with isKanban annotation', async () => {
    const { app, tmpDir } = await buildAppWithSetup();
    try {
      // Browse VAULT_FIXTURE/Tasks — contains board.md (kanban) + other-board.md (kanban)
      const tasksDir = path.join(VAULT_FIXTURE, 'Tasks');
      const res = await request(app).get(`/api/setup/browse?path=${encodeURIComponent(tasksDir)}&mode=files`);
      expect(res.status).toBe(200);
      expect(res.body.resolvedPath).toBe(tasksDir);
      const files = res.body.entries.filter(e => e.kind === 'file');
      expect(files.map(f => f.name).sort()).toEqual(['board.md', 'other-board.md']);
      expect(files.every(f => f.isKanban === true)).toBe(true);
    } finally {
      await fs.rm(tmpDir, { recursive: true, force: true });
    }
  });

  test('folders mode lists subdirs only with hasObsidianMarker annotation', async () => {
    const { app, tmpDir } = await buildAppWithSetup();
    try {
      // Browse the parent of VAULT_FIXTURE — vault-tree/ should appear as a folder with hasObsidianMarker: true
      const parentDir = path.dirname(VAULT_FIXTURE);
      const res = await request(app).get(`/api/setup/browse?path=${encodeURIComponent(parentDir)}&mode=folders`);
      expect(res.status).toBe(200);
      const vaultEntry = res.body.entries.find(e => e.name === 'vault-tree');
      expect(vaultEntry).toBeDefined();
      expect(vaultEntry.kind).toBe('directory');
      expect(vaultEntry.hasObsidianMarker).toBe(true);
      const fileEntries = res.body.entries.filter(e => e.kind === 'file');
      expect(fileEntries).toHaveLength(0);
    } finally {
      await fs.rm(tmpDir, { recursive: true, force: true });
    }
  });

  test('returns 403 for path outside HOME', async () => {
    const { app, tmpDir } = await buildAppWithSetup();
    try {
      const res = await request(app).get('/api/setup/browse?path=%2Fetc&mode=files');
      expect(res.status).toBe(403);
      expect(res.body.error).toBe('path_out_of_bounds');
    } finally {
      await fs.rm(tmpDir, { recursive: true, force: true });
    }
  });

  test('defaults to home directory when path omitted', async () => {
    const { app, tmpDir } = await buildAppWithSetup();
    try {
      const res = await request(app).get('/api/setup/browse?mode=files');
      expect(res.status).toBe(200);
      expect(res.body.resolvedPath).toBe(await fs.realpath(os.homedir()));
    } finally {
      await fs.rm(tmpDir, { recursive: true, force: true });
    }
  });

  test('returns 400 for invalid mode', async () => {
    const { app, tmpDir } = await buildAppWithSetup();
    try {
      const res = await request(app).get('/api/setup/browse?mode=bogus');
      expect(res.status).toBe(400);
    } finally {
      await fs.rm(tmpDir, { recursive: true, force: true });
    }
  });
});
```

- [ ] **Step 2: Run tests — verify RED**

```bash
npm test --workspace=server
```

Expected: new browse tests fail (route not defined).

- [ ] **Step 3: Extend `server/routes/setup.js`**

Add these imports at the top (next to the existing imports):

```js
import os from 'os';
import { assertPathSafe } from '../core/pathGuard.js';
import { isKanbanFile, inferVaultName } from '../core/vaultScanner.js';
```

Inside `createSetupRoute`, add this route registration before `return router;`:

```js
const BROWSE_CAP = 500;

router.get('/browse', async (req, res, next) => {
  try {
    const mode = req.query.mode;
    if (mode !== 'files' && mode !== 'folders') {
      return res.status(400).json({ error: 'invalid_mode', message: 'mode must be "files" or "folders"' });
    }
    const inputPath = req.query.path || os.homedir();
    let canonical;
    try {
      canonical = await assertPathSafe(inputPath);
    } catch (err) {
      if (err.code === 'PATH_OUT_OF_BOUNDS') {
        return res.status(403).json({ error: 'path_out_of_bounds', message: err.message });
      }
      if (err.code === 'PATH_NOT_FOUND') {
        return res.status(400).json({ error: 'path_not_found', message: err.message });
      }
      throw err;
    }

    const stat = await fs.stat(canonical);
    if (!stat.isDirectory()) {
      return res.status(400).json({ error: 'not_a_directory', message: `${canonical} is not a directory` });
    }

    const rawEntries = await fs.readdir(canonical, { withFileTypes: true });
    const dirs = [];
    const files = [];
    for (const entry of rawEntries) {
      const fullPath = path.join(canonical, entry.name);
      if (entry.isDirectory()) {
        const out = { name: entry.name, fullPath, kind: 'directory' };
        if (mode === 'folders') {
          out.hasObsidianMarker = await dirHasObsidianMarker(fullPath);
        }
        dirs.push(out);
      } else if (entry.isFile() && mode === 'files' && entry.name.endsWith('.md')) {
        const out = { name: entry.name, fullPath, kind: 'file' };
        out.isKanban = await isKanbanFile(fullPath);
        if (out.isKanban) {
          out.inferredVault = await inferVaultName(fullPath);
        }
        files.push(out);
      }
    }

    dirs.sort((a, b) => a.name.localeCompare(b.name));
    files.sort((a, b) => a.name.localeCompare(b.name));
    const combined = [...dirs, ...files];
    const truncated = combined.length > BROWSE_CAP;
    const limited = truncated ? combined.slice(0, BROWSE_CAP) : combined;

    const parent = canonical === '/' ? null : path.dirname(canonical);

    res.json({
      resolvedPath: canonical,
      parent,
      entries: limited,
      truncated,
    });
  } catch (err) {
    next(err);
  }
});

async function dirHasObsidianMarker(dirPath) {
  try {
    const st = await fs.stat(path.join(dirPath, '.obsidian'));
    return st.isDirectory();
  } catch {
    return false;
  }
}
```

- [ ] **Step 4: Run tests — verify GREEN**

```bash
npm test --workspace=server
```

Expected: 124 tests pass (119 + 5 new).

- [ ] **Step 5: Commit**

```bash
git add server/routes/setup.js server/tests/routes-setup.test.js
git commit -m "feat(routes): GET /api/setup/browse with files/folders modes + path-safety"
```

---

### Task 8: `POST /api/setup/scan-vault` route

**Files:**
- Modify: `server/routes/setup.js`
- Modify: `server/tests/routes-setup.test.js`

- [ ] **Step 1: Append failing tests**

```js
describe('POST /api/setup/scan-vault', () => {
  test('returns kanban-marker files + auto-detected vault name', async () => {
    const { app, tmpDir } = await buildAppWithSetup();
    try {
      const res = await request(app).post('/api/setup/scan-vault').send({ path: VAULT_FIXTURE });
      expect(res.status).toBe(200);
      expect(res.body.vaultName).toBe('vault-tree');
      const paths = res.body.boards.map(b => b.relativePath).sort();
      expect(paths).toEqual(['Tasks/board.md', 'Tasks/other-board.md']);
    } finally {
      await fs.rm(tmpDir, { recursive: true, force: true });
    }
  });

  test('returns 403 for path outside HOME', async () => {
    const { app, tmpDir } = await buildAppWithSetup();
    try {
      const res = await request(app).post('/api/setup/scan-vault').send({ path: '/etc' });
      expect(res.status).toBe(403);
    } finally {
      await fs.rm(tmpDir, { recursive: true, force: true });
    }
  });

  test('returns 400 for missing path body', async () => {
    const { app, tmpDir } = await buildAppWithSetup();
    try {
      const res = await request(app).post('/api/setup/scan-vault').send({});
      expect(res.status).toBe(400);
    } finally {
      await fs.rm(tmpDir, { recursive: true, force: true });
    }
  });
});
```

- [ ] **Step 2: Run tests — verify RED**

```bash
npm test --workspace=server
```

Expected: new scan-vault tests fail.

- [ ] **Step 3: Add scan-vault route to `server/routes/setup.js`**

Add this import at the top:

```js
import { scanVault } from '../core/vaultScanner.js';
```

Inside `createSetupRoute`, add this route registration:

```js
router.post('/scan-vault', async (req, res, next) => {
  try {
    const inputPath = req.body && req.body.path;
    if (!inputPath || typeof inputPath !== 'string') {
      return res.status(400).json({ error: 'missing_path' });
    }
    let canonical;
    try {
      canonical = await assertPathSafe(inputPath);
    } catch (err) {
      if (err.code === 'PATH_OUT_OF_BOUNDS') {
        return res.status(403).json({ error: 'path_out_of_bounds', message: err.message });
      }
      if (err.code === 'PATH_NOT_FOUND') {
        return res.status(400).json({ error: 'path_not_found', message: err.message });
      }
      throw err;
    }
    const stat = await fs.stat(canonical);
    if (!stat.isDirectory()) {
      return res.status(400).json({ error: 'not_a_directory' });
    }
    const result = await scanVault(canonical);
    res.json(result);
  } catch (err) {
    next(err);
  }
});
```

- [ ] **Step 4: Run tests — verify GREEN**

```bash
npm test --workspace=server
```

Expected: 127 tests pass (124 + 3 new).

- [ ] **Step 5: Commit**

```bash
git add server/routes/setup.js server/tests/routes-setup.test.js
git commit -m "feat(routes): POST /api/setup/scan-vault"
```

---

### Task 9: `POST /api/setup/save-sources` route

**Files:**
- Modify: `server/routes/setup.js`
- Modify: `server/tests/routes-setup.test.js`

- [ ] **Step 1: Append failing tests**

```js
describe('POST /api/setup/save-sources', () => {
  test('writes config, rebuilds adapters, returns saved sources', async () => {
    const { app, tmpDir, aggregator } = await buildAppWithSetup();
    try {
      const body = {
        sources: [
          { id: 'obsidian', adapter: 'ObsidianAdapter',
            config: { file: BOARD_FIXTURE, vault: 'TestVault' }, pollIntervalSec: 60 },
        ],
      };
      const res = await request(app).post('/api/setup/save-sources').send(body);
      expect(res.status).toBe(200);
      expect(res.body.saved).toBe(true);
      expect(res.body.sourceCount).toBe(1);

      // Verify config was written
      const written = JSON.parse(await fs.readFile(path.join(tmpDir, 'config', 'sources.json'), 'utf8'));
      expect(written.sources).toHaveLength(1);

      // Verify aggregator now has an adapter
      const result = await aggregator.collectAll();
      expect(result.meta.sources[0].id).toBe('obsidian');
    } finally {
      await fs.rm(tmpDir, { recursive: true, force: true });
    }
  });

  test('rejects sources with invalid kanban files (file does not exist)', async () => {
    const { app, tmpDir } = await buildAppWithSetup();
    try {
      const body = {
        sources: [
          { id: 'obsidian', adapter: 'ObsidianAdapter',
            config: { file: path.join(tmpDir, 'no-such-file.md'), vault: 'V' }, pollIntervalSec: 60 },
        ],
      };
      const res = await request(app).post('/api/setup/save-sources').send(body);
      expect(res.status).toBe(400);
      expect(res.body.saved).toBe(false);
      expect(res.body.errors[0].error).toBe('invalid_kanban');
    } finally {
      await fs.rm(tmpDir, { recursive: true, force: true });
    }
  });

  test('deduplicates by canonical file path', async () => {
    const { app, tmpDir } = await buildAppWithSetup();
    try {
      const body = {
        sources: [
          { id: 's1', adapter: 'ObsidianAdapter', config: { file: BOARD_FIXTURE, vault: 'A' }, pollIntervalSec: 60 },
          { id: 's2', adapter: 'ObsidianAdapter', config: { file: BOARD_FIXTURE, vault: 'B' }, pollIntervalSec: 60 },
        ],
      };
      const res = await request(app).post('/api/setup/save-sources').send(body);
      expect(res.status).toBe(200);
      expect(res.body.sourceCount).toBe(1);
    } finally {
      await fs.rm(tmpDir, { recursive: true, force: true });
    }
  });

  test('writes empty sources array (used when removing all sources)', async () => {
    const { app, tmpDir, aggregator } = await buildAppWithSetup();
    try {
      const res = await request(app).post('/api/setup/save-sources').send({ sources: [] });
      expect(res.status).toBe(200);
      expect(res.body.sourceCount).toBe(0);
      const written = JSON.parse(await fs.readFile(path.join(tmpDir, 'config', 'sources.json'), 'utf8'));
      expect(written.sources).toEqual([]);
      const result = await aggregator.collectAll();
      expect(result.quests).toEqual([]);
    } finally {
      await fs.rm(tmpDir, { recursive: true, force: true });
    }
  });
});
```

- [ ] **Step 2: Run tests — verify RED**

```bash
npm test --workspace=server
```

Expected: new save-sources tests fail.

- [ ] **Step 3: Add save-sources route to `server/routes/setup.js`**

Add these imports at the top:

```js
import { writeSourcesConfig } from '../core/configWriter.js';
import { parseBoard } from '../parsers/kanbanMarkdown.js';
```

Inside `createSetupRoute`, add:

```js
router.post('/save-sources', async (req, res, next) => {
  try {
    const incoming = req.body && Array.isArray(req.body.sources) ? req.body.sources : null;
    if (incoming === null) {
      return res.status(400).json({ error: 'missing_sources' });
    }

    // Validate each source. Errors are accumulated; first dedupe by canonical path.
    const seen = new Set();
    const valid = [];
    const errors = [];

    for (let i = 0; i < incoming.length; i++) {
      const src = incoming[i];
      if (!src.config || typeof src.config.file !== 'string') {
        errors.push({ index: i, error: 'invalid_source', reason: 'missing config.file' });
        continue;
      }
      let canonical;
      try {
        canonical = await assertPathSafe(src.config.file);
      } catch (err) {
        errors.push({ index: i, error: 'invalid_kanban', file: src.config.file, reason: err.message });
        continue;
      }
      if (seen.has(canonical)) {
        // dedupe — silently keep the first occurrence
        continue;
      }
      seen.add(canonical);

      // Verify file is parseable as a kanban board
      try {
        const raw = await fs.readFile(canonical, 'utf8');
        const board = parseBoard(raw);
        if (!board.lanes || board.lanes.length === 0) {
          errors.push({ index: i, error: 'invalid_kanban', file: canonical, reason: 'no lanes found' });
          continue;
        }
      } catch (err) {
        errors.push({ index: i, error: 'invalid_kanban', file: canonical, reason: err.message });
        continue;
      }

      valid.push({
        ...src,
        config: { ...src.config, file: canonical },
      });
    }

    if (errors.length > 0) {
      return res.status(400).json({ saved: false, errors });
    }

    // Atomic write
    await writeSourcesConfig(rootDir, valid);

    // Hot-reload adapters
    const newAdapters = valid.map(s => {
      const Cls = adapterRegistry[s.adapter];
      if (!Cls) throw new Error(`Unknown adapter: ${s.adapter}`);
      return new Cls(s.config);
    });
    aggregator.replaceAdapters(newAdapters);

    res.json({
      saved: true,
      sourceCount: valid.length,
      sources: valid.map(s => ({
        id: s.id,
        adapter: s.adapter,
        file: s.config.file,
        vault: s.config.vault,
      })),
    });
  } catch (err) {
    next(err);
  }
});
```

- [ ] **Step 4: Run tests — verify GREEN**

```bash
npm test --workspace=server
```

Expected: 131 tests pass (127 + 4 new).

- [ ] **Step 5: Commit**

```bash
git add server/routes/setup.js server/tests/routes-setup.test.js
git commit -m "feat(routes): POST /api/setup/save-sources with validation, dedup, hot-reload"
```

---

## Phase 4: Server bootstrap

### Task 10: Wire setup route + setupNeeded meta in /api/quests + graceful boot

**Files:**
- Modify: `server/index.js`
- Modify: `server/routes/quests.js`
- Modify: `server/tests/routes.test.js`

- [ ] **Step 1: Add failing test for setupNeeded meta**

Append to `server/tests/routes.test.js`:

```js
describe('GET /api/quests — setupNeeded meta', () => {
  test('returns setupNeeded: true in meta when adapter list is empty', async () => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'qd-empty-'));
    try {
      const historyFile = path.join(tmpDir, 'history.jsonl');
      const history = createHistoryStore(historyFile);
      const aggregator = createAggregator([], history);  // empty adapters
      const app = express();
      app.use('/api/quests', createQuestsRoute({ aggregator }));
      const res = await request(app).get('/api/quests');
      expect(res.status).toBe(200);
      expect(res.body.meta.setupNeeded).toBe(true);
      expect(res.body.quests).toEqual([]);
    } finally {
      await fs.rm(tmpDir, { recursive: true, force: true });
    }
  });

  test('returns setupNeeded: false when at least one adapter present', async () => {
    const built = await buildApp();
    try {
      const res = await request(built.app).get('/api/quests');
      expect(res.status).toBe(200);
      expect(res.body.meta.setupNeeded).toBeFalsy();
    } finally {
      await fs.rm(built.tmpDir, { recursive: true, force: true });
    }
  });
});
```

Also add `import os from 'os';` at the top if not present.

- [ ] **Step 2: Run tests — verify RED**

```bash
npm test --workspace=server
```

Expected: first new test fails (`setupNeeded` not in meta).

- [ ] **Step 3: Modify `server/routes/quests.js` to include setupNeeded**

Replace the file content with:

```js
import { Router } from 'express';

export function createQuestsRoute({ aggregator }) {
  const router = Router();

  router.get('/', async (req, res, next) => {
    try {
      const result = await aggregator.collectAll();
      const setupNeeded = result.meta.sources.length === 0;
      res.json({
        ...result,
        meta: { ...result.meta, setupNeeded },
      });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
```

- [ ] **Step 4: Run tests — verify GREEN**

```bash
npm test --workspace=server
```

Expected: 133 tests pass (131 + 2 new).

- [ ] **Step 5: Wire `/api/setup` router into `server/index.js`**

Open `server/index.js`. Add this import at the top with the other route imports:

```js
import { createSetupRoute } from './routes/setup.js';
```

Inside the `main()` function, AFTER the adapters array is built and BEFORE the existing `app.use('/api/quests', ...)` line, add:

```js
app.use('/api/setup', createSetupRoute({ rootDir: PROJECT_ROOT, aggregator, adapterRegistry: ADAPTER_REGISTRY }));
```

The existing line that throws on unknown adapter is fine to keep. But also wrap the `adapters` construction in a guard for empty sources:

```js
const adapters = (sources.sources || []).map((s) => {
  const Cls = ADAPTER_REGISTRY[s.adapter];
  if (!Cls) throw new Error(`Unknown adapter: ${s.adapter}`);
  return new Cls(s.config);
});
```

And the backfill loop should be a no-op when `adapters` is empty (already handled by the for-loop being empty).

- [ ] **Step 6: Smoke test — boot server with empty config**

```bash
# Save current config aside
cp config/sources.json /tmp/qd-real-sources.json
rm config/sources.json

# Boot
node server/index.js > /tmp/qd-bootcheck.log 2>&1 &
SERVER_PID=$!
sleep 1.5

echo "=== /api/setup/status ==="
curl -s http://localhost:3274/api/setup/status
echo
echo "=== /api/quests ==="
curl -s http://localhost:3274/api/quests | head -c 200
echo

kill $SERVER_PID 2>/dev/null
wait $SERVER_PID 2>/dev/null

# Restore
mv /tmp/qd-real-sources.json config/sources.json
```

Expected:
- `/api/setup/status` returns `{"setupNeeded":true,"sources":[]}`
- `/api/quests` returns `{"quests":[],"categories":[],"meta":{"lastSyncAt":"...","sources":[],"setupNeeded":true}}`
- Server log shows "Loaded 0 adapter(s)" and listens on 3274.

- [ ] **Step 7: Commit**

```bash
git add server/index.js server/routes/quests.js server/tests/routes.test.js
git commit -m "feat(server): mount /api/setup; /api/quests reports setupNeeded; graceful empty-config boot"
```

---

## Phase 5: Client API + hooks

### Task 11: `client/src/lib/setupApi.js`

**Files:**
- Create: `client/src/lib/setupApi.js`
- Create: `client/src/tests/setupApi.test.js`

- [ ] **Step 1: Write failing tests**

Create `client/src/tests/setupApi.test.js`:

```js
import { describe, test, expect, vi, beforeEach } from 'vitest';
import { getSetupStatus, browse, scanVault, saveSources } from '../lib/setupApi.js';

beforeEach(() => {
  global.fetch = vi.fn();
});

describe('getSetupStatus', () => {
  test('GETs /api/setup/status', async () => {
    global.fetch.mockResolvedValue({ ok: true, json: async () => ({ setupNeeded: true, sources: [] }) });
    const result = await getSetupStatus();
    expect(global.fetch).toHaveBeenCalledWith('/api/setup/status');
    expect(result.setupNeeded).toBe(true);
  });
});

describe('browse', () => {
  test('GETs /api/setup/browse with path + mode', async () => {
    global.fetch.mockResolvedValue({ ok: true, json: async () => ({ entries: [], parent: null, resolvedPath: '/' }) });
    await browse({ path: '/home/user', mode: 'files' });
    expect(global.fetch).toHaveBeenCalledWith('/api/setup/browse?path=%2Fhome%2Fuser&mode=files');
  });

  test('throws PATH_OUT_OF_BOUNDS on 403', async () => {
    global.fetch.mockResolvedValue({ ok: false, status: 403, json: async () => ({ error: 'path_out_of_bounds' }) });
    await expect(browse({ path: '/etc', mode: 'files' })).rejects.toMatchObject({ code: 'PATH_OUT_OF_BOUNDS' });
  });
});

describe('scanVault', () => {
  test('POSTs to /api/setup/scan-vault', async () => {
    global.fetch.mockResolvedValue({ ok: true, json: async () => ({ vaultName: 'V', boards: [], truncated: false }) });
    await scanVault('/home/user/V');
    expect(global.fetch).toHaveBeenCalledWith('/api/setup/scan-vault', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: '/home/user/V' }),
    });
  });
});

describe('saveSources', () => {
  test('POSTs sources array', async () => {
    global.fetch.mockResolvedValue({ ok: true, json: async () => ({ saved: true, sourceCount: 1 }) });
    const sources = [{ id: 'x', adapter: 'ObsidianAdapter', config: { file: '/f.md', vault: 'V' }, pollIntervalSec: 60 }];
    await saveSources(sources);
    expect(global.fetch).toHaveBeenCalledWith('/api/setup/save-sources', expect.objectContaining({
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    }));
  });

  test('throws VALIDATION_ERROR on 400 with errors payload', async () => {
    global.fetch.mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({ saved: false, errors: [{ index: 0, error: 'invalid_kanban' }] }),
    });
    try {
      await saveSources([]);
      throw new Error('should have thrown');
    } catch (err) {
      expect(err.code).toBe('VALIDATION_ERROR');
      expect(err.errors).toHaveLength(1);
    }
  });
});
```

- [ ] **Step 2: Run tests — verify RED**

```bash
npm test --workspace=client
```

Expected: setupApi tests fail (module not found).

- [ ] **Step 3: Implement `client/src/lib/setupApi.js`**

```js
export async function getSetupStatus() {
  const res = await fetch('/api/setup/status');
  if (!res.ok) throw new Error(`getSetupStatus failed: ${res.status}`);
  return res.json();
}

export async function browse({ path, mode }) {
  const params = new URLSearchParams();
  if (path) params.set('path', path);
  params.set('mode', mode);
  const res = await fetch(`/api/setup/browse?${params.toString()}`);
  if (!res.ok) {
    if (res.status === 403) {
      const body = await res.json().catch(() => ({}));
      const err = new Error('path_out_of_bounds');
      err.code = 'PATH_OUT_OF_BOUNDS';
      err.detail = body;
      throw err;
    }
    throw new Error(`browse failed: ${res.status}`);
  }
  return res.json();
}

export async function scanVault(vaultPath) {
  const res = await fetch('/api/setup/scan-vault', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path: vaultPath }),
  });
  if (!res.ok) {
    if (res.status === 403) {
      const err = new Error('path_out_of_bounds');
      err.code = 'PATH_OUT_OF_BOUNDS';
      throw err;
    }
    throw new Error(`scanVault failed: ${res.status}`);
  }
  return res.json();
}

export async function saveSources(sources) {
  const res = await fetch('/api/setup/save-sources', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sources }),
  });
  if (!res.ok) {
    if (res.status === 400) {
      const body = await res.json().catch(() => ({}));
      const err = new Error('validation failed');
      err.code = 'VALIDATION_ERROR';
      err.errors = body.errors || [];
      throw err;
    }
    throw new Error(`saveSources failed: ${res.status}`);
  }
  return res.json();
}
```

- [ ] **Step 4: Run tests — verify GREEN**

```bash
npm test --workspace=client
```

Expected: 39 client tests pass (33 + 6 new).

- [ ] **Step 5: Commit**

```bash
git add client/src/lib/setupApi.js client/src/tests/setupApi.test.js
git commit -m "feat(client): setupApi wrappers for /api/setup/* endpoints"
```

---

### Task 12: `useSetupStatus` hook

**Files:**
- Create: `client/src/hooks/useSetupStatus.js`

- [ ] **Step 1: Implement hook**

```js
import { useState, useEffect, useCallback } from 'react';
import { getSetupStatus } from '../lib/setupApi.js';

export function useSetupStatus() {
  const [status, setStatus] = useState({ setupNeeded: false, sources: [], loading: true, error: null });

  const refresh = useCallback(async () => {
    try {
      const result = await getSetupStatus();
      setStatus({ setupNeeded: result.setupNeeded, sources: result.sources, loading: false, error: null });
    } catch (err) {
      setStatus(prev => ({ ...prev, loading: false, error: err }));
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { ...status, refresh };
}
```

- [ ] **Step 2: Verify no regressions**

```bash
npm test --workspace=client
```

Expected: 39 tests still pass.

- [ ] **Step 3: Commit**

```bash
git add client/src/hooks/useSetupStatus.js
git commit -m "feat(client): useSetupStatus hook"
```

---

## Phase 6: Client onboarding components

### Task 13: `BrowserRow` leaf component

**Files:**
- Create: `client/src/components/onboarding/BrowserRow.jsx`
- Create: `client/src/tests/BrowserRow.test.jsx`

- [ ] **Step 1: Write failing test**

Create `client/src/tests/BrowserRow.test.jsx`:

```jsx
import { describe, test, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BrowserRow } from '../components/onboarding/BrowserRow.jsx';

describe('BrowserRow', () => {
  test('renders directory entry with folder icon, calls onNavigate on click', () => {
    const onNavigate = vi.fn();
    render(<BrowserRow entry={{ name: 'Docs', kind: 'directory', fullPath: '/x/Docs' }} onNavigate={onNavigate} />);
    fireEvent.click(screen.getByText('Docs'));
    expect(onNavigate).toHaveBeenCalledWith('/x/Docs');
  });

  test('shows (vault) badge when hasObsidianMarker is true', () => {
    render(<BrowserRow entry={{ name: 'MyVault', kind: 'directory', fullPath: '/x/MyVault', hasObsidianMarker: true }} onNavigate={() => {}} />);
    expect(screen.getByText(/vault/i)).toBeInTheDocument();
  });

  test('shows kanban badge for isKanban file, clickable when allowed', () => {
    const onToggle = vi.fn();
    render(<BrowserRow entry={{ name: 'board.md', kind: 'file', fullPath: '/x/board.md', isKanban: true }} selectable selected={false} onToggle={onToggle} />);
    expect(screen.getByText(/kanban/i)).toBeInTheDocument();
    fireEvent.click(screen.getByText('board.md'));
    expect(onToggle).toHaveBeenCalledWith('/x/board.md');
  });

  test('non-kanban file renders greyed out, not clickable', () => {
    const onToggle = vi.fn();
    render(<BrowserRow entry={{ name: 'note.md', kind: 'file', fullPath: '/x/note.md', isKanban: false }} selectable selected={false} onToggle={onToggle} />);
    fireEvent.click(screen.getByText('note.md'));
    expect(onToggle).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run tests — verify RED**

```bash
npm test --workspace=client
```

- [ ] **Step 3: Implement `client/src/components/onboarding/BrowserRow.jsx`**

```jsx
export function BrowserRow({ entry, onNavigate, onToggle, selectable = false, selected = false }) {
  const isDir = entry.kind === 'directory';
  const isKanban = entry.kind === 'file' && entry.isKanban === true;
  const clickable = isDir || (selectable && isKanban);

  const handleClick = () => {
    if (!clickable) return;
    if (isDir) onNavigate(entry.fullPath);
    else onToggle(entry.fullPath);
  };

  const icon = isDir ? '▸' : ' ';
  const badge = isDir && entry.hasObsidianMarker
    ? <span className="ml-2 text-[10px] uppercase tracking-widest opacity-70">(vault)</span>
    : isKanban
      ? <span className="ml-2 text-[10px] uppercase tracking-widest text-hud-success">[kanban]</span>
      : null;

  const opacityClass = clickable ? '' : 'opacity-30';
  const selectedClass = selected ? 'bg-hud-accent/20 border-hud-accent' : 'border-transparent';

  return (
    <div
      className={`flex items-center gap-2 px-3 py-2 border ${selectedClass} ${opacityClass} ${clickable ? 'cursor-pointer hover:bg-hud-surface' : 'cursor-default'}`}
      onClick={handleClick}
    >
      <span aria-hidden>{selectable && isKanban ? (selected ? '☑' : '☐') : icon}</span>
      <span className="text-sm">{entry.name}</span>
      {badge}
    </div>
  );
}
```

- [ ] **Step 4: Run tests — verify GREEN**

```bash
npm test --workspace=client
```

Expected: 43 tests pass (39 + 4 new).

- [ ] **Step 5: Commit**

```bash
git add client/src/components/onboarding/BrowserRow.jsx client/src/tests/BrowserRow.test.jsx
git commit -m "feat(client): BrowserRow shared row component"
```

---

### Task 14: `ModePicker` component

**Files:**
- Create: `client/src/components/onboarding/ModePicker.jsx`
- Create: `client/src/tests/ModePicker.test.jsx`

- [ ] **Step 1: Write failing tests**

```jsx
import { describe, test, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ModePicker } from '../components/onboarding/ModePicker.jsx';

describe('ModePicker', () => {
  test('renders two mode buttons', () => {
    render(<ModePicker onPickFiles={() => {}} onPickVault={() => {}} />);
    expect(screen.getByRole('button', { name: /pick specific/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /scan a vault/i })).toBeInTheDocument();
  });

  test('fires onPickFiles when first button clicked', () => {
    const onPickFiles = vi.fn();
    render(<ModePicker onPickFiles={onPickFiles} onPickVault={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: /pick specific/i }));
    expect(onPickFiles).toHaveBeenCalled();
  });

  test('fires onPickVault when second button clicked', () => {
    const onPickVault = vi.fn();
    render(<ModePicker onPickFiles={() => {}} onPickVault={onPickVault} />);
    fireEvent.click(screen.getByRole('button', { name: /scan a vault/i }));
    expect(onPickVault).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run tests — verify RED**

- [ ] **Step 3: Implement `client/src/components/onboarding/ModePicker.jsx`**

```jsx
export function ModePicker({ onPickFiles, onPickVault }) {
  return (
    <div className="flex flex-col gap-4 max-w-2xl mx-auto">
      <h2 className="text-lg uppercase tracking-widest text-hud-accent glow text-center mb-4">
        ◆ Add Kanban Sources
      </h2>
      <p className="text-center opacity-70 text-sm mb-4">
        Choose how to find your kanban boards:
      </p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <button
          type="button"
          onClick={onPickFiles}
          className="p-6 border border-hud-border hover:border-hud-accent bg-hud-surface text-left"
        >
          <p className="text-sm font-bold text-hud-accent uppercase tracking-widest mb-2">Pick specific file(s)</p>
          <p className="text-xs opacity-70">Navigate to one or more kanban .md files and pick them individually.</p>
        </button>
        <button
          type="button"
          onClick={onPickVault}
          className="p-6 border border-hud-border hover:border-hud-accent bg-hud-surface text-left"
        >
          <p className="text-sm font-bold text-hud-accent uppercase tracking-widest mb-2">Scan a vault folder</p>
          <p className="text-xs opacity-70">Point at an Obsidian vault and we'll auto-detect every kanban board inside it.</p>
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run tests — verify GREEN**

```bash
npm test --workspace=client
```

Expected: 46 tests pass (43 + 3 new).

- [ ] **Step 5: Commit**

```bash
git add client/src/components/onboarding/ModePicker.jsx client/src/tests/ModePicker.test.jsx
git commit -m "feat(client): ModePicker entry screen"
```

---

### Task 15: `ExistingSourcesList` component

**Files:**
- Create: `client/src/components/onboarding/ExistingSourcesList.jsx`
- Create: `client/src/tests/ExistingSourcesList.test.jsx`

- [ ] **Step 1: Write failing tests**

```jsx
import { describe, test, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ExistingSourcesList } from '../components/onboarding/ExistingSourcesList.jsx';

const sampleSources = [
  { id: 'obsidian', file: '/home/u/vault/board.md', vault: 'MyVault' },
  { id: 'obsidian-2', file: '/home/u/vault/other.md', vault: 'MyVault' },
];

describe('ExistingSourcesList', () => {
  test('renders nothing when sources is empty', () => {
    const { container } = render(<ExistingSourcesList sources={[]} onRemove={() => {}} />);
    expect(container.firstChild).toBeNull();
  });

  test('renders each source with file path and vault', () => {
    render(<ExistingSourcesList sources={sampleSources} onRemove={() => {}} />);
    expect(screen.getByText('/home/u/vault/board.md')).toBeInTheDocument();
    expect(screen.getByText('/home/u/vault/other.md')).toBeInTheDocument();
    expect(screen.getAllByText('MyVault')).toHaveLength(2);
  });

  test('calls onRemove with the source file path when X clicked', () => {
    const onRemove = vi.fn();
    render(<ExistingSourcesList sources={sampleSources} onRemove={onRemove} />);
    const removeButtons = screen.getAllByRole('button', { name: /remove/i });
    fireEvent.click(removeButtons[0]);
    expect(onRemove).toHaveBeenCalledWith('/home/u/vault/board.md');
  });
});
```

- [ ] **Step 2: Run tests — verify RED**

- [ ] **Step 3: Implement `client/src/components/onboarding/ExistingSourcesList.jsx`**

```jsx
export function ExistingSourcesList({ sources, onRemove }) {
  if (!sources || sources.length === 0) return null;
  return (
    <section className="max-w-2xl mx-auto mb-8 p-4 border border-hud-border bg-hud-surface">
      <h3 className="text-xs uppercase tracking-widest opacity-70 mb-3">Currently configured sources</h3>
      <ul className="space-y-2">
        {sources.map(src => (
          <li key={src.file} className="flex items-center justify-between gap-2">
            <div className="text-sm">
              <p className="text-hud-accent truncate">{src.file}</p>
              <p className="text-[10px] uppercase tracking-widest opacity-60">vault: {src.vault}</p>
            </div>
            <button
              type="button"
              onClick={() => onRemove(src.file)}
              aria-label={`Remove ${src.file}`}
              className="px-2 py-1 text-xs border border-hud-warn text-hud-warn hover:bg-hud-warn/10"
            >
              ✕
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
```

- [ ] **Step 4: Run tests — verify GREEN**

Expected: 49 tests pass (46 + 3 new).

- [ ] **Step 5: Commit**

```bash
git add client/src/components/onboarding/ExistingSourcesList.jsx client/src/tests/ExistingSourcesList.test.jsx
git commit -m "feat(client): ExistingSourcesList for settings re-entry"
```

---

### Task 16: `FileBrowser` component

**Files:**
- Create: `client/src/components/onboarding/FileBrowser.jsx`
- Create: `client/src/tests/FileBrowser.test.jsx`

- [ ] **Step 1: Write failing tests**

```jsx
import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { FileBrowser } from '../components/onboarding/FileBrowser.jsx';
import * as setupApi from '../lib/setupApi.js';

vi.mock('../lib/setupApi.js');

const sampleResponse = {
  resolvedPath: '/home/u',
  parent: '/home',
  entries: [
    { name: 'Docs', kind: 'directory', fullPath: '/home/u/Docs' },
    { name: 'board.md', kind: 'file', fullPath: '/home/u/board.md', isKanban: true, inferredVault: 'u' },
    { name: 'note.md', kind: 'file', fullPath: '/home/u/note.md', isKanban: false },
  ],
  truncated: false,
};

beforeEach(() => {
  setupApi.browse.mockReset();
  setupApi.browse.mockResolvedValue(sampleResponse);
});

describe('FileBrowser', () => {
  test('fetches and renders entries on mount', async () => {
    render(<FileBrowser onNext={() => {}} onBack={() => {}} />);
    await waitFor(() => expect(screen.getByText('Docs')).toBeInTheDocument());
    expect(screen.getByText('board.md')).toBeInTheDocument();
    expect(screen.getByText('note.md')).toBeInTheDocument();
  });

  test('clicking a directory navigates into it', async () => {
    setupApi.browse
      .mockResolvedValueOnce(sampleResponse)
      .mockResolvedValueOnce({ ...sampleResponse, resolvedPath: '/home/u/Docs', parent: '/home/u', entries: [] });

    render(<FileBrowser onNext={() => {}} onBack={() => {}} />);
    await waitFor(() => expect(screen.getByText('Docs')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Docs'));
    await waitFor(() => expect(setupApi.browse).toHaveBeenLastCalledWith({ path: '/home/u/Docs', mode: 'files' }));
  });

  test('clicking a kanban file selects it; Next is enabled', async () => {
    render(<FileBrowser onNext={() => {}} onBack={() => {}} />);
    await waitFor(() => expect(screen.getByText('board.md')).toBeInTheDocument());
    expect(screen.getByRole('button', { name: /next/i })).toBeDisabled();
    fireEvent.click(screen.getByText('board.md'));
    expect(screen.getByRole('button', { name: /next/i })).not.toBeDisabled();
  });

  test('Next calls onNext with selected files (with inferredVault attached)', async () => {
    const onNext = vi.fn();
    render(<FileBrowser onNext={onNext} onBack={() => {}} />);
    await waitFor(() => expect(screen.getByText('board.md')).toBeInTheDocument());
    fireEvent.click(screen.getByText('board.md'));
    fireEvent.click(screen.getByRole('button', { name: /next/i }));
    expect(onNext).toHaveBeenCalledWith([
      { fullPath: '/home/u/board.md', name: 'board.md', inferredVault: 'u' },
    ]);
  });
});
```

- [ ] **Step 2: Run tests — verify RED**

- [ ] **Step 3: Implement `client/src/components/onboarding/FileBrowser.jsx`**

```jsx
import { useState, useEffect, useCallback } from 'react';
import { browse } from '../../lib/setupApi.js';
import { BrowserRow } from './BrowserRow.jsx';

export function FileBrowser({ onNext, onBack, initialPath }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedByPath, setSelectedByPath] = useState({});

  const load = useCallback(async (path) => {
    setLoading(true);
    setError(null);
    try {
      const result = await browse({ path, mode: 'files' });
      setData(result);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(initialPath); }, [load, initialPath]);

  const navigate = (path) => load(path);
  const toggle = (fullPath) => {
    setSelectedByPath(prev => {
      const next = { ...prev };
      if (next[fullPath]) delete next[fullPath];
      else {
        const entry = data?.entries.find(e => e.fullPath === fullPath);
        next[fullPath] = entry;
      }
      return next;
    });
  };

  const selectedList = Object.values(selectedByPath);
  const selectedCount = selectedList.length;

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-3">
        <p className="text-xs uppercase tracking-widest opacity-70">Current path</p>
        <p className="text-sm font-mono text-hud-accent truncate">{data?.resolvedPath || '...'}</p>
      </div>

      {data?.parent && (
        <BrowserRow entry={{ name: '..', kind: 'directory', fullPath: data.parent }} onNavigate={navigate} />
      )}

      {loading && <p className="opacity-70 text-sm py-4">Loading...</p>}
      {error && <p className="text-hud-warn text-sm py-4">{error.message}</p>}

      {data && !loading && (
        <div className="max-h-96 overflow-y-auto border border-hud-border">
          {data.entries.map(entry => (
            <BrowserRow
              key={entry.fullPath}
              entry={entry}
              onNavigate={navigate}
              onToggle={toggle}
              selectable
              selected={!!selectedByPath[entry.fullPath]}
            />
          ))}
          {data.truncated && (
            <p className="text-xs opacity-70 p-2 text-center">Showing 500 entries — narrow your path to see more.</p>
          )}
        </div>
      )}

      <div className="mt-4 flex items-center justify-between">
        <button type="button" onClick={onBack} className="px-3 py-2 border border-hud-border text-hud-accent text-xs uppercase tracking-widest">
          Back
        </button>
        <p className="text-xs opacity-70">{selectedCount} file{selectedCount === 1 ? '' : 's'} selected</p>
        <button
          type="button"
          onClick={() => onNext(selectedList.map(e => ({ fullPath: e.fullPath, name: e.name, inferredVault: e.inferredVault ?? null })))}
          disabled={selectedCount === 0}
          className={`px-3 py-2 text-xs uppercase tracking-widest ${selectedCount === 0 ? 'border border-hud-border opacity-40 cursor-not-allowed' : 'bg-hud-accent text-hud-bg font-bold'}`}
        >
          Next →
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run tests — verify GREEN**

Expected: 53 tests pass (49 + 4 new).

- [ ] **Step 5: Commit**

```bash
git add client/src/components/onboarding/FileBrowser.jsx client/src/tests/FileBrowser.test.jsx
git commit -m "feat(client): FileBrowser with multi-select + greyed-out non-kanban entries"
```

---

### Task 17: `FolderBrowser` component

**Files:**
- Create: `client/src/components/onboarding/FolderBrowser.jsx`
- Create: `client/src/tests/FolderBrowser.test.jsx`

- [ ] **Step 1: Write failing tests**

```jsx
import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { FolderBrowser } from '../components/onboarding/FolderBrowser.jsx';
import * as setupApi from '../lib/setupApi.js';

vi.mock('../lib/setupApi.js');

const sampleResponse = {
  resolvedPath: '/home/u',
  parent: '/home',
  entries: [
    { name: 'MyVault', kind: 'directory', fullPath: '/home/u/MyVault', hasObsidianMarker: true },
    { name: 'Other', kind: 'directory', fullPath: '/home/u/Other', hasObsidianMarker: false },
  ],
  truncated: false,
};

beforeEach(() => {
  setupApi.browse.mockReset();
  setupApi.browse.mockResolvedValue(sampleResponse);
});

describe('FolderBrowser', () => {
  test('renders folders only (single-select)', async () => {
    render(<FolderBrowser onScan={() => {}} onBack={() => {}} />);
    await waitFor(() => expect(screen.getByText('MyVault')).toBeInTheDocument());
    expect(screen.getByText('Other')).toBeInTheDocument();
    expect(screen.getByText(/vault/i)).toBeInTheDocument(); // (vault) badge
  });

  test('clicking a folder selects it (and triggers Scan to enable)', async () => {
    render(<FolderBrowser onScan={() => {}} onBack={() => {}} />);
    await waitFor(() => expect(screen.getByText('MyVault')).toBeInTheDocument());
    expect(screen.getByRole('button', { name: /scan/i })).toBeDisabled();
    // To select a folder we need a different gesture than navigating in.
    // We use a separate "Pick this folder" button per row OR a "Pick current folder" button.
    fireEvent.click(screen.getByRole('button', { name: /pick this folder/i }));
    expect(screen.getByRole('button', { name: /scan/i })).not.toBeDisabled();
  });

  test('clicking Scan calls onScan with selected path', async () => {
    const onScan = vi.fn();
    render(<FolderBrowser onScan={onScan} onBack={() => {}} />);
    await waitFor(() => expect(screen.getByText('MyVault')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /pick this folder/i }));
    fireEvent.click(screen.getByRole('button', { name: /scan/i }));
    expect(onScan).toHaveBeenCalledWith('/home/u');
  });
});
```

- [ ] **Step 2: Run tests — verify RED**

- [ ] **Step 3: Implement `client/src/components/onboarding/FolderBrowser.jsx`**

```jsx
import { useState, useEffect, useCallback } from 'react';
import { browse } from '../../lib/setupApi.js';
import { BrowserRow } from './BrowserRow.jsx';

export function FolderBrowser({ onScan, onBack, initialPath }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedPath, setSelectedPath] = useState(null);

  const load = useCallback(async (path) => {
    setLoading(true);
    setError(null);
    setSelectedPath(null);
    try {
      const result = await browse({ path, mode: 'folders' });
      setData(result);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(initialPath); }, [load, initialPath]);

  const navigate = (path) => load(path);

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-widest opacity-70">Current folder</p>
          <p className="text-sm font-mono text-hud-accent truncate">{data?.resolvedPath || '...'}</p>
        </div>
        <button
          type="button"
          onClick={() => setSelectedPath(data?.resolvedPath ?? null)}
          disabled={!data}
          className="px-2 py-1 text-xs uppercase tracking-widest border border-hud-accent text-hud-accent hover:bg-hud-accent/20"
        >
          Pick this folder
        </button>
      </div>

      {data?.parent && (
        <BrowserRow entry={{ name: '..', kind: 'directory', fullPath: data.parent }} onNavigate={navigate} />
      )}

      {loading && <p className="opacity-70 text-sm py-4">Loading...</p>}
      {error && <p className="text-hud-warn text-sm py-4">{error.message}</p>}

      {data && !loading && (
        <div className="max-h-96 overflow-y-auto border border-hud-border">
          {data.entries.map(entry => (
            <BrowserRow key={entry.fullPath} entry={entry} onNavigate={navigate} />
          ))}
          {data.entries.length === 0 && (
            <p className="text-xs opacity-50 p-3 text-center">No subfolders here.</p>
          )}
        </div>
      )}

      <div className="mt-4 flex items-center justify-between">
        <button type="button" onClick={onBack} className="px-3 py-2 border border-hud-border text-hud-accent text-xs uppercase tracking-widest">
          Back
        </button>
        <p className="text-xs opacity-70">{selectedPath ? `Selected: ${selectedPath}` : 'None selected'}</p>
        <button
          type="button"
          onClick={() => selectedPath && onScan(selectedPath)}
          disabled={!selectedPath}
          className={`px-3 py-2 text-xs uppercase tracking-widest ${!selectedPath ? 'border border-hud-border opacity-40 cursor-not-allowed' : 'bg-hud-accent text-hud-bg font-bold'}`}
        >
          Scan →
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run tests — verify GREEN**

Expected: 56 tests pass (53 + 3 new).

- [ ] **Step 5: Commit**

```bash
git add client/src/components/onboarding/FolderBrowser.jsx client/src/tests/FolderBrowser.test.jsx
git commit -m "feat(client): FolderBrowser with single-select + (vault) badge"
```

---

### Task 18: `ScanProgress` + `ConfirmLoading` transient screens

**Files:**
- Create: `client/src/components/onboarding/ScanProgress.jsx`
- Create: `client/src/components/onboarding/ConfirmLoading.jsx`

- [ ] **Step 1: Implement both (compact, no separate tests)**

`client/src/components/onboarding/ScanProgress.jsx`:

```jsx
export function ScanProgress({ vaultPath }) {
  return (
    <div className="max-w-md mx-auto text-center p-8">
      <p className="text-lg uppercase tracking-widest text-hud-accent glow mb-4">SCANNING…</p>
      <p className="text-xs opacity-70 font-mono break-all">{vaultPath}</p>
      <p className="text-xs opacity-50 mt-4">Looking for kanban-plugin board files.</p>
    </div>
  );
}
```

`client/src/components/onboarding/ConfirmLoading.jsx`:

```jsx
export function ConfirmLoading() {
  return (
    <div className="max-w-md mx-auto text-center p-8">
      <p className="text-lg uppercase tracking-widest text-hud-accent glow">SAVING + RELOADING…</p>
      <p className="text-xs opacity-50 mt-4">Your dashboard will appear in a moment.</p>
    </div>
  );
}
```

- [ ] **Step 2: Verify no regressions**

```bash
npm test --workspace=client
```

Expected: 56 tests still pass.

- [ ] **Step 3: Commit**

```bash
git add client/src/components/onboarding/ScanProgress.jsx client/src/components/onboarding/ConfirmLoading.jsx
git commit -m "feat(client): ScanProgress + ConfirmLoading transient screens"
```

---

### Task 19: `ChecklistReview` component

**Files:**
- Create: `client/src/components/onboarding/ChecklistReview.jsx`
- Create: `client/src/tests/ChecklistReview.test.jsx`

- [ ] **Step 1: Write failing tests**

```jsx
import { describe, test, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ChecklistReview } from '../components/onboarding/ChecklistReview.jsx';

const candidates = [
  { fullPath: '/home/u/v/a.md', name: 'a.md', inferredVault: 'v' },
  { fullPath: '/home/u/v/b.md', name: 'b.md', inferredVault: 'v' },
  { fullPath: '/home/u/c.md', name: 'c.md', inferredVault: null },
];

describe('ChecklistReview', () => {
  test('renders one row per candidate, all pre-checked', () => {
    render(<ChecklistReview candidates={candidates} onBack={() => {}} onConfirm={() => {}} />);
    expect(screen.getByText('/home/u/v/a.md')).toBeInTheDocument();
    expect(screen.getByText('/home/u/v/b.md')).toBeInTheDocument();
    expect(screen.getByText('/home/u/c.md')).toBeInTheDocument();
    const checkboxes = screen.getAllByRole('checkbox');
    expect(checkboxes.every(c => c.checked)).toBe(true);
  });

  test('unchecking a row excludes it from confirm payload', () => {
    const onConfirm = vi.fn();
    render(<ChecklistReview candidates={candidates} onBack={() => {}} onConfirm={onConfirm} />);
    const checkboxes = screen.getAllByRole('checkbox');
    fireEvent.click(checkboxes[0]); // uncheck first
    fireEvent.click(screen.getByRole('button', { name: /confirm/i }));
    const payload = onConfirm.mock.calls[0][0];
    expect(payload).toHaveLength(2);
    expect(payload.map(p => p.file)).toEqual(['/home/u/v/b.md', '/home/u/c.md']);
  });

  test('confirm button disabled when 0 rows checked', () => {
    render(<ChecklistReview candidates={candidates} onBack={() => {}} onConfirm={() => {}} />);
    const checkboxes = screen.getAllByRole('checkbox');
    checkboxes.forEach(c => fireEvent.click(c));
    expect(screen.getByRole('button', { name: /confirm/i })).toBeDisabled();
  });

  test('vault input pre-filled from inferredVault and editable', () => {
    const onConfirm = vi.fn();
    render(<ChecklistReview candidates={candidates} onBack={() => {}} onConfirm={onConfirm} />);
    const vaultInputs = screen.getAllByPlaceholderText(/vault/i);
    expect(vaultInputs[0].value).toBe('v');
    expect(vaultInputs[2].value).toBe(''); // null → empty
    fireEvent.change(vaultInputs[2], { target: { value: 'MyVault' } });
    fireEvent.click(screen.getByRole('button', { name: /confirm/i }));
    const payload = onConfirm.mock.calls[0][0];
    expect(payload[2].vault).toBe('MyVault');
  });
});
```

- [ ] **Step 2: Run tests — verify RED**

- [ ] **Step 3: Implement `client/src/components/onboarding/ChecklistReview.jsx`**

```jsx
import { useState } from 'react';

export function ChecklistReview({ candidates, onBack, onConfirm }) {
  const [rows, setRows] = useState(() =>
    candidates.map(c => ({
      file: c.fullPath,
      name: c.name,
      vault: c.inferredVault || '',
      checked: true,
    }))
  );

  const checkedCount = rows.filter(r => r.checked).length;

  const toggle = (idx) => setRows(prev =>
    prev.map((r, i) => i === idx ? { ...r, checked: !r.checked } : r)
  );

  const updateVault = (idx, value) => setRows(prev =>
    prev.map((r, i) => i === idx ? { ...r, vault: value } : r)
  );

  const handleConfirm = () => {
    const selected = rows.filter(r => r.checked).map(r => ({
      file: r.file,
      vault: r.vault,
    }));
    onConfirm(selected);
  };

  return (
    <div className="max-w-3xl mx-auto">
      <h2 className="text-lg uppercase tracking-widest text-hud-accent glow text-center mb-4">
        ◆ Review Sources
      </h2>
      <p className="text-center opacity-70 text-sm mb-4">
        Detected {candidates.length} board{candidates.length === 1 ? '' : 's'}. Uncheck any you don't want included.
      </p>

      <div className="border border-hud-border">
        {rows.map((row, idx) => (
          <div key={row.file} className="flex items-center gap-3 px-3 py-2 border-b border-hud-border last:border-b-0">
            <input
              type="checkbox"
              checked={row.checked}
              onChange={() => toggle(idx)}
              aria-label={`Include ${row.name}`}
            />
            <p className="flex-1 text-sm font-mono text-hud-accent truncate">{row.file}</p>
            <label className="flex items-center gap-2">
              <span className="text-[10px] uppercase tracking-widest opacity-70">vault</span>
              <input
                type="text"
                value={row.vault}
                onChange={(e) => updateVault(idx, e.target.value)}
                placeholder="Vault name"
                className="w-32 px-2 py-1 text-xs bg-hud-bg border border-hud-border text-hud-accent"
              />
            </label>
          </div>
        ))}
      </div>

      <div className="mt-4 flex items-center justify-between">
        <button type="button" onClick={onBack} className="px-3 py-2 border border-hud-border text-hud-accent text-xs uppercase tracking-widest">
          Back
        </button>
        <p className="text-xs opacity-70">{checkedCount} of {rows.length} selected</p>
        <button
          type="button"
          onClick={handleConfirm}
          disabled={checkedCount === 0}
          className={`px-3 py-2 text-xs uppercase tracking-widest ${checkedCount === 0 ? 'border border-hud-border opacity-40 cursor-not-allowed' : 'bg-hud-accent text-hud-bg font-bold'}`}
        >
          Confirm + Load Dashboard →
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run tests — verify GREEN**

Expected: 60 tests pass (56 + 4 new).

- [ ] **Step 5: Commit**

```bash
git add client/src/components/onboarding/ChecklistReview.jsx client/src/tests/ChecklistReview.test.jsx
git commit -m "feat(client): ChecklistReview with per-row vault input + Confirm gating"
```

---

### Task 20: `OnboardingFlow` wizard shell

**Files:**
- Create: `client/src/components/onboarding/OnboardingFlow.jsx`
- Create: `client/src/tests/OnboardingFlow.test.jsx`

- [ ] **Step 1: Write failing tests**

```jsx
import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { OnboardingFlow } from '../components/onboarding/OnboardingFlow.jsx';
import * as setupApi from '../lib/setupApi.js';

vi.mock('../lib/setupApi.js');

beforeEach(() => {
  setupApi.browse.mockReset();
  setupApi.scanVault.mockReset();
  setupApi.saveSources.mockReset();
  setupApi.browse.mockResolvedValue({
    resolvedPath: '/home/u',
    parent: null,
    entries: [
      { name: 'board.md', kind: 'file', fullPath: '/home/u/board.md', isKanban: true, inferredVault: 'u' },
    ],
    truncated: false,
  });
  setupApi.scanVault.mockResolvedValue({
    vaultName: 'V',
    boards: [{ relativePath: 'a.md', fullPath: '/home/u/V/a.md', inferredVault: 'V' }],
    truncated: false,
    filesScanned: 1,
  });
  setupApi.saveSources.mockResolvedValue({ saved: true, sourceCount: 1 });
});

describe('OnboardingFlow', () => {
  test('starts at MODE_PICK', () => {
    render(<OnboardingFlow mode="first-run" existingSources={[]} onComplete={() => {}} />);
    expect(screen.getByRole('button', { name: /pick specific/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /scan a vault/i })).toBeInTheDocument();
  });

  test('settings mode shows ExistingSourcesList', () => {
    const sources = [{ id: 'o', file: '/x.md', vault: 'V' }];
    render(<OnboardingFlow mode="settings" existingSources={sources} onComplete={() => {}} onRemoveSource={() => {}} />);
    expect(screen.getByText('/x.md')).toBeInTheDocument();
  });

  test('full file-picker flow: MODE_PICK → BROWSE_FILES → REVIEW → SAVING → DONE', async () => {
    const onComplete = vi.fn();
    render(<OnboardingFlow mode="first-run" existingSources={[]} onComplete={onComplete} />);

    fireEvent.click(screen.getByRole('button', { name: /pick specific/i }));
    await waitFor(() => expect(screen.getByText('board.md')).toBeInTheDocument());

    fireEvent.click(screen.getByText('board.md'));
    fireEvent.click(screen.getByRole('button', { name: /next/i }));

    // REVIEW
    await waitFor(() => expect(screen.getByText('/home/u/board.md')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /confirm/i }));

    // SAVING → DONE → onComplete fires
    await waitFor(() => expect(onComplete).toHaveBeenCalled());
    expect(setupApi.saveSources).toHaveBeenCalled();
  });

  test('vault-scan flow: MODE_PICK → BROWSE_FOLDERS → SCANNING → REVIEW → SAVING → DONE', async () => {
    const onComplete = vi.fn();
    setupApi.browse.mockResolvedValue({
      resolvedPath: '/home/u',
      parent: null,
      entries: [{ name: 'V', kind: 'directory', fullPath: '/home/u/V', hasObsidianMarker: true }],
      truncated: false,
    });

    render(<OnboardingFlow mode="first-run" existingSources={[]} onComplete={onComplete} />);
    fireEvent.click(screen.getByRole('button', { name: /scan a vault/i }));
    await waitFor(() => expect(screen.getByText('V')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /pick this folder/i }));
    fireEvent.click(screen.getByRole('button', { name: /scan/i }));

    await waitFor(() => expect(screen.getByText('/home/u/V/a.md')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /confirm/i }));
    await waitFor(() => expect(onComplete).toHaveBeenCalled());
  });
});
```

- [ ] **Step 2: Run tests — verify RED**

- [ ] **Step 3: Implement `client/src/components/onboarding/OnboardingFlow.jsx`**

```jsx
import { useState } from 'react';
import { ModePicker } from './ModePicker.jsx';
import { ExistingSourcesList } from './ExistingSourcesList.jsx';
import { FileBrowser } from './FileBrowser.jsx';
import { FolderBrowser } from './FolderBrowser.jsx';
import { ScanProgress } from './ScanProgress.jsx';
import { ChecklistReview } from './ChecklistReview.jsx';
import { ConfirmLoading } from './ConfirmLoading.jsx';
import { scanVault, saveSources } from '../../lib/setupApi.js';

export function OnboardingFlow({ mode, existingSources, onComplete, onRemoveSource }) {
  const [state, setState] = useState('MODE_PICK');
  const [candidates, setCandidates] = useState([]);
  const [scanTargetPath, setScanTargetPath] = useState(null);
  const [error, setError] = useState(null);

  const handlePickFiles = () => setState('BROWSE_FILES');
  const handlePickVault = () => setState('BROWSE_FOLDERS');

  const handleFilesNext = (selectedEntries) => {
    setCandidates(selectedEntries);
    setState('REVIEW');
  };

  const handleScan = async (vaultPath) => {
    setScanTargetPath(vaultPath);
    setState('SCANNING');
    try {
      const result = await scanVault(vaultPath);
      const cands = result.boards.map(b => ({
        fullPath: b.fullPath,
        name: b.relativePath.split('/').pop(),
        inferredVault: b.inferredVault ?? result.vaultName ?? null,
      }));
      setCandidates(cands);
      setState('REVIEW');
    } catch (err) {
      setError(err);
      setState('ERROR');
    }
  };

  const handleConfirm = async (selected) => {
    setState('SAVING');
    try {
      // Build full source descriptors
      const sources = selected.map((row, idx) => ({
        id: idx === 0 ? 'obsidian' : `obsidian-${idx}`,
        adapter: 'ObsidianAdapter',
        config: { file: row.file, vault: row.vault },
        pollIntervalSec: 60,
      }));
      // Merge with existing in settings mode
      const merged = mode === 'settings'
        ? [...existingSources.map(s => ({
            id: s.id,
            adapter: s.adapter || 'ObsidianAdapter',
            config: { file: s.file, vault: s.vault },
            pollIntervalSec: 60,
          })), ...sources]
        : sources;
      await saveSources(merged);
      setState('DONE');
      onComplete();
    } catch (err) {
      setError(err);
      setState('ERROR');
    }
  };

  return (
    <div className="min-h-screen p-8">
      {state === 'MODE_PICK' && (
        <>
          {mode === 'settings' && (
            <ExistingSourcesList sources={existingSources} onRemove={onRemoveSource} />
          )}
          <ModePicker onPickFiles={handlePickFiles} onPickVault={handlePickVault} />
        </>
      )}

      {state === 'BROWSE_FILES' && (
        <FileBrowser
          onNext={handleFilesNext}
          onBack={() => setState('MODE_PICK')}
        />
      )}

      {state === 'BROWSE_FOLDERS' && (
        <FolderBrowser
          onScan={handleScan}
          onBack={() => setState('MODE_PICK')}
        />
      )}

      {state === 'SCANNING' && <ScanProgress vaultPath={scanTargetPath} />}

      {state === 'REVIEW' && (
        <ChecklistReview
          candidates={candidates}
          onBack={() => setState('MODE_PICK')}
          onConfirm={handleConfirm}
        />
      )}

      {state === 'SAVING' && <ConfirmLoading />}

      {state === 'ERROR' && (
        <div className="max-w-md mx-auto text-center p-8">
          <p className="text-hud-warn uppercase tracking-widest mb-2">Error</p>
          <p className="text-sm opacity-80">{error?.message}</p>
          <button
            type="button"
            onClick={() => setState('MODE_PICK')}
            className="mt-4 px-3 py-2 border border-hud-accent text-hud-accent text-xs uppercase tracking-widest"
          >
            Back
          </button>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Run tests — verify GREEN**

```bash
npm test --workspace=client
```

Expected: 64 tests pass (60 + 4 new).

- [ ] **Step 5: Commit**

```bash
git add client/src/components/onboarding/OnboardingFlow.jsx client/src/tests/OnboardingFlow.test.jsx
git commit -m "feat(client): OnboardingFlow wizard shell with state machine"
```

---

## Phase 7: Integration

### Task 21: useQuests update for setupNeeded

**Files:**
- Modify: `client/src/hooks/useQuests.js`

- [ ] **Step 1: Replace `client/src/hooks/useQuests.js`**

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

  const setupNeeded = data.meta?.setupNeeded === true;
  return { ...data, loading, error, refetch, setupNeeded };
}
```

(The only addition is `setupNeeded` derived from `data.meta` and returned.)

- [ ] **Step 2: Run tests — verify no regressions**

```bash
npm test --workspace=client
```

Expected: 64 tests still pass.

- [ ] **Step 3: Commit**

```bash
git add client/src/hooks/useQuests.js
git commit -m "feat(client): useQuests exposes setupNeeded from meta"
```

---

### Task 22: HeaderHUD ⚙ Settings button

**Files:**
- Modify: `client/src/components/HeaderHUD.jsx`

- [ ] **Step 1: Replace `client/src/components/HeaderHUD.jsx`**

Open the file. The component currently accepts `{ history, lastSyncAt, onRefresh, showCompleted, onToggleCompleted }`. Add `onOpenSettings` as a new prop and a button next to the existing toggle.

Replace the inner `<div className="flex items-center gap-3">` block (the one containing `SyncIndicator` + `ShowCompletedToggle`) with:

```jsx
<div className="flex items-center gap-3">
  <SyncIndicator lastSyncAt={lastSyncAt} onRefresh={onRefresh} />
  <ShowCompletedToggle show={showCompleted} onToggle={onToggleCompleted} />
  {onOpenSettings && (
    <button
      type="button"
      onClick={onOpenSettings}
      aria-label="Settings"
      className="px-2 py-1 text-xs uppercase tracking-widest border border-hud-border text-hud-accent hover:border-hud-accent"
    >
      ⚙
    </button>
  )}
</div>
```

Add `onOpenSettings` to the component's prop destructuring at the top:

```jsx
export function HeaderHUD({ history, lastSyncAt, onRefresh, showCompleted, onToggleCompleted, onOpenSettings }) {
```

- [ ] **Step 2: Run tests — verify no regressions**

```bash
npm test --workspace=client
```

Expected: 64 tests still pass (HeaderHUD has no unit tests; covered by App-level integration).

- [ ] **Step 3: Commit**

```bash
git add client/src/components/HeaderHUD.jsx
git commit -m "feat(client): HeaderHUD ⚙ Settings button"
```

---

### Task 23: Wire App.jsx with setupNeeded + Settings flow

**Files:**
- Modify: `client/src/App.jsx`

- [ ] **Step 1: Replace `client/src/App.jsx`**

```jsx
import { useState, useMemo, useCallback } from 'react';
import { useQuests } from './hooks/useQuests.js';
import { useHistory } from './hooks/useHistory.js';
import { useShowCompleted } from './hooks/useShowCompleted.js';
import { useSetupStatus } from './hooks/useSetupStatus.js';
import { HeaderHUD } from './components/HeaderHUD.jsx';
import { CategorySection } from './components/CategorySection.jsx';
import { QuestModal } from './components/QuestModal.jsx';
import { OnboardingFlow } from './components/onboarding/OnboardingFlow.jsx';
import { postComplete } from './lib/api.js';
import { saveSources } from './lib/setupApi.js';

export default function App() {
  const setup = useSetupStatus();
  const { quests, categories, meta, loading, error, refetch, setupNeeded } = useQuests();
  const { history, refetch: refetchHistory } = useHistory();
  const { show: showCompleted, toggle: toggleCompleted } = useShowCompleted();
  const [selectedQuest, setSelectedQuest] = useState(null);
  const [toast, setToast] = useState(null);
  const [settingsOpen, setSettingsOpen] = useState(false);

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

  const showToast = (kind, message, ms = 2500) => {
    setToast({ kind, message });
    setTimeout(() => setToast(null), ms);
  };

  const handleComplete = async (quest) => {
    try {
      const res = await postComplete(quest.id);
      setSelectedQuest(null);
      showToast('success', `+${res.xpAwarded} XP — ${quest.title}`);
      await Promise.all([refetch(), refetchHistory()]);
    } catch (err) {
      if (err.code === 'CONFLICT') {
        setSelectedQuest(null);
        showToast('warn', 'Quest changed in source — refreshing…');
        await refetch();
      } else if (err.code === 'SUBTASKS_INCOMPLETE') {
        showToast('warn', `Complete all objectives first (${err.remaining} remaining)`);
      } else {
        showToast('error', `Error: ${err.message}`);
      }
    }
  };

  const handleObjectiveComplete = async (subtask) => {
    try {
      const res = await postComplete(subtask.id);
      if (res.parentCompleted) {
        setSelectedQuest(null);
        showToast('success', `+${res.xpAwarded} XP — ${res.parent?.title ?? 'Quest complete'}`);
        await Promise.all([refetch(), refetchHistory()]);
      } else {
        showToast('success', `Objective complete: ${subtask.title}`, 1500);
        refetch();
      }
    } catch (err) {
      if (err.code === 'CONFLICT') {
        setSelectedQuest(null);
        showToast('warn', 'Quest changed in source — refreshing…');
        await refetch();
      } else {
        showToast('error', `Error: ${err.message}`);
      }
    }
  };

  const handleOnboardingComplete = useCallback(async () => {
    setSettingsOpen(false);
    await setup.refresh();
    await refetch();
  }, [setup, refetch]);

  const handleRemoveSource = async (filePath) => {
    try {
      const remaining = setup.sources
        .filter(s => s.file !== filePath)
        .map(s => ({
          id: s.id,
          adapter: s.adapter || 'ObsidianAdapter',
          config: { file: s.file, vault: s.vault },
          pollIntervalSec: 60,
        }));
      await saveSources(remaining);
      await setup.refresh();
      await refetch();
      showToast('success', 'Source removed');
    } catch (err) {
      showToast('error', `Error removing source: ${err.message}`);
    }
  };

  // First-run: setup needed AND not loading the status
  const showOnboarding = (setupNeeded || settingsOpen) && !setup.loading;
  const onboardingMode = settingsOpen ? 'settings' : 'first-run';

  if (showOnboarding) {
    return (
      <OnboardingFlow
        mode={onboardingMode}
        existingSources={setup.sources}
        onComplete={handleOnboardingComplete}
        onRemoveSource={handleRemoveSource}
      />
    );
  }

  if ((loading || setup.loading) && quests.length === 0) {
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
          onOpenSettings={() => setSettingsOpen(true)}
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
        onOpenSettings={() => setSettingsOpen(true)}
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
          onObjectiveComplete={handleObjectiveComplete}
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

- [ ] **Step 2: Run tests + production build**

```bash
npm test --workspace=client
npm run build --workspace=client
```

Expected: 64 client tests pass; build succeeds.

- [ ] **Step 3: Commit**

```bash
git add client/src/App.jsx
git commit -m "feat(client): wire App for setupNeeded onboarding + Settings re-entry + remove-source"
```

---

## Phase 8: Verification

### Task 24: Full test suite + production build + manual smoke

**Files:** none modified (verification only)

- [ ] **Step 1: Run full test suites**

```bash
npm test --workspace=server
npm test --workspace=client
```

Expected: 133 server tests + 64 client tests = 197 total passing.

- [ ] **Step 2: Production build**

```bash
npm run build --workspace=client
```

Expected: build succeeds, output sizes similar to v1.1 (~155 KB JS + ~12 KB CSS).

- [ ] **Step 3: Manual end-to-end smoke (against fixture, with empty config)**

```bash
# Save current config aside
cp config/sources.json /tmp/qd-real-sources.json
rm -f config/sources.json data/.backfilled-obsidian data/xp-history.jsonl

# Boot
node server/index.js > /tmp/qd-onboard.log 2>&1 &
SERVER_PID=$!
sleep 1.5

# /status should say setupNeeded
curl -s http://localhost:3274/api/setup/status
echo

# Browse home dir
curl -s "http://localhost:3274/api/setup/browse?mode=folders" | head -c 300
echo

# Scan the test fixture vault
curl -s -X POST -H "Content-Type: application/json" \
  -d "{\"path\":\"$(pwd)/server/tests/fixtures/vault-tree\"}" \
  http://localhost:3274/api/setup/scan-vault
echo

# Save the fixture board as a source
curl -s -X POST -H "Content-Type: application/json" \
  -d "{\"sources\":[{\"id\":\"obsidian\",\"adapter\":\"ObsidianAdapter\",\"config\":{\"file\":\"$(pwd)/server/tests/fixtures/vault-tree/Tasks/board.md\",\"vault\":\"vault-tree\"},\"pollIntervalSec\":60}]}" \
  http://localhost:3274/api/setup/save-sources
echo

# /status should now say setupNeeded: false
curl -s http://localhost:3274/api/setup/status
echo

# /quests should return the fixture's tasks
curl -s http://localhost:3274/api/quests | python3 -c "import sys,json;d=json.load(sys.stdin);print(f'Quests: {len(d[\"quests\"])}, setupNeeded: {d[\"meta\"].get(\"setupNeeded\",False)}')"

kill $SERVER_PID 2>/dev/null
wait $SERVER_PID 2>/dev/null

# Restore real config
mv /tmp/qd-real-sources.json config/sources.json
rm -f data/.backfilled-obsidian data/xp-history.jsonl
```

Expected flow:
- `/status` returns `setupNeeded: true` initially
- `/browse` returns directories
- `/scan-vault` finds 1 board in the fixture vault
- `/save-sources` returns `saved: true`
- `/status` returns `setupNeeded: false`
- `/quests` returns at least 1 quest

If any step fails, STOP and report the error before committing.

- [ ] **Step 4: Browser-driven manual smoke (user-driven)**

This step requires the user to interact in the browser.

1. Stop any running dev servers.
2. `rm -f config/sources.json`
3. `npm run dev`
4. Open `http://localhost:5274/` — onboarding should appear instead of the dashboard.
5. Click "Scan a vault folder" — folder browser appears.
6. Navigate to the real vault. Click "Pick this folder". Click "Scan →".
7. Wait for scan; checklist appears with detected boards.
8. Confirm. Dashboard loads with real quests.
9. Click ⚙ Settings in the header — onboarding reappears with the "Currently configured sources" panel.
10. Add another source (or remove one). Confirm — dashboard reflects the change without restart.

If anything in the browser feels off, report it.

---

## Self-Review Checklist

- [ ] **Spec coverage** — every section of [SPEC-v1.2-onboarding.md](SPEC-v1.2-onboarding.md) maps to at least one task:
  - §2.1 State machine → Task 20 (OnboardingFlow)
  - §2.2 Entry points → Task 23 (App.jsx wiring)
  - §2.3 MODE_PICK + ExistingSourcesList → Tasks 14, 15
  - §2.4 BROWSE_FILES → Task 16
  - §2.5 BROWSE_FOLDERS → Task 17
  - §2.6 SCANNING → Task 18
  - §2.7 REVIEW → Task 19
  - §2.8 SAVING + DONE → Task 18 + Task 20 (orchestration)
  - §2.9 ERROR → Task 20 (handled in OnboardingFlow)
  - §3.1 GET /api/setup/status → Task 6
  - §3.2 GET /api/setup/browse → Task 7
  - §3.3 POST /api/setup/scan-vault → Task 8
  - §3.4 POST /api/setup/save-sources → Task 9
  - §4 Server boot resilience → Task 3 + Task 10
  - §5 Path security → Task 1 (pathGuard) + Tasks 7, 8, 9 (use)
  - §6 Hot-reload adapters → Task 4 + Task 9 (route invokes replaceAdapters)
  - §7 Component structure → Tasks 11-23
  - §8 Edge cases → covered across Tasks 1, 5, 7, 9, 20
  - §9 Testing strategy → tests embedded in each task

- [ ] **All tests passing** (server + client)
- [ ] **Production build succeeds**
- [ ] **Manual smoke completes against fixture vault** (Task 24 Step 3)
- [ ] **No `TODO`, `TBD`, or placeholder strings remain in code**
