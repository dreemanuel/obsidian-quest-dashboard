# Quest Dashboard v1.1 — Interactive Subtasks Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make subtasks in `QuestModal` clickable; ticking the last subtask auto-completes the parent and awards its XP; parent's "Mark Complete" button is disabled while objectives remain incomplete.

**Architecture:** Server-side detection of "all siblings done" inside `ObsidianAdapter.markComplete` keeps the parent-completion atomic. Modal maintains a local `objectives` array for optimistic UI updates and instant `<ObjectivesBar>` fill animation.

**Tech Stack:** Same as v1 — Node + Express + Vitest backend, Vite + React + Tailwind + Testing Library frontend.

**Companion docs:** [SPEC-v1.1-subtasks.md](SPEC-v1.1-subtasks.md), [SPEC.md](SPEC.md), [ARCHITECTURE.md](ARCHITECTURE.md)

---

## Phase 1: Parser + Adapter

### Task 1: Make `markLineComplete` date-optional + add `areAllSubtasksComplete` helper

**Files:**
- Modify: `server/parsers/kanbanMarkdown.js`
- Modify: `server/tests/kanbanMarkdown.test.js`

- [ ] **Step 1: Write failing tests**

Append to `server/tests/kanbanMarkdown.test.js`:

```js
import { areAllSubtasksComplete } from '../parsers/kanbanMarkdown.js';

describe('markLineComplete — optional date', () => {
  test('without dateStr → writes `- [x] title` (no date stamp)', () => {
    const line = '\t- [ ] Subtask one';
    const updated = markLineComplete(line);
    expect(updated).toBe('\t- [x] Subtask one');
  });
  test('with dateStr → still appends date (unchanged v1 behavior)', () => {
    const line = '- [ ] Parent';
    const updated = markLineComplete(line, '2026-05-25');
    expect(updated).toBe('- [x] Parent ✅ 2026-05-25');
  });
});

describe('areAllSubtasksComplete', () => {
  test('returns true when every indented checkbox after parent is - [x]', () => {
    const lines = [
      '- [ ] Parent',
      '\t- [x] one',
      '\t- [x] two',
      '',
      '- [ ] Next top-level',
    ];
    expect(areAllSubtasksComplete(lines, 0)).toBe(true);
  });
  test('returns false when any indented checkbox is - [ ]', () => {
    const lines = [
      '- [ ] Parent',
      '\t- [x] one',
      '\t- [ ] two',
      '- [ ] Next',
    ];
    expect(areAllSubtasksComplete(lines, 0)).toBe(false);
  });
  test('returns true when parent has no subtasks at all', () => {
    const lines = [
      '- [ ] Parent',
      '',
      '- [ ] Next',
    ];
    expect(areAllSubtasksComplete(lines, 0)).toBe(true);
  });
  test('stops scanning at the next top-level task line', () => {
    const lines = [
      '- [ ] Parent',
      '\t- [x] one',
      '- [ ] Other top-level',
      '\t- [ ] other subtask',
    ];
    expect(areAllSubtasksComplete(lines, 0)).toBe(true);
  });
  test('stops scanning at a lane header (## ...)', () => {
    const lines = [
      '- [ ] Parent',
      '\t- [x] one',
      '## Next Lane',
      '- [ ] something',
    ];
    expect(areAllSubtasksComplete(lines, 0)).toBe(true);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm test --workspace=server
```

Expected: `markLineComplete — optional date` (case 1) fails (current impl always appends date); `areAllSubtasksComplete` tests fail with module not found.

- [ ] **Step 3: Modify `server/parsers/kanbanMarkdown.js`**

Replace the existing `markLineComplete` function with:

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
  const datePart = dateStr ? ` ✅ ${dateStr}` : '';
  return `${indent}- [x] ${cleanBody}${datePart}`;
}
```

Append at end of file:

```js
const LANE_HEADER_RE_LOCAL = /^##\s+(.+)$/;

export function areAllSubtasksComplete(lines, parentLine) {
  for (let i = parentLine + 1; i < lines.length; i++) {
    const line = lines[i];
    if (LANE_HEADER_RE_LOCAL.test(line)) break;
    const taskMatch = line.match(TASK_LINE_RE);
    if (!taskMatch) continue; // blank line, comment, etc.
    const [, indent, mark] = taskMatch;
    if (indent.length === 0) break; // next top-level task
    if (mark !== 'x') return false;
  }
  return true;
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm test --workspace=server
```

Expected: all 80 prior server tests + 7 new tests = 87 pass.

- [ ] **Step 5: Commit**

```bash
git add server/parsers/kanbanMarkdown.js server/tests/kanbanMarkdown.test.js
git commit -m "feat(parser): optional date in markLineComplete + areAllSubtasksComplete helper"
```

---

### Task 2: Add `expectedTitle` to subtask sourceRef in ObsidianAdapter

**Files:**
- Modify: `server/adapters/ObsidianAdapter.js`
- Modify: `server/tests/ObsidianAdapter.test.js`

- [ ] **Step 1: Write failing test**

Append to `server/tests/ObsidianAdapter.test.js`:

```js
describe('ObsidianAdapter — subtask sourceRef', () => {
  test('objectives carry expectedTitle in their sourceRef', async () => {
    const adapter = new ObsidianAdapter({ file: workingFile, vault: 'TestVault' });
    const quests = await adapter.listQuests();
    const parent = quests.find(q => q.title === 'Personal task');
    expect(parent.objectives.length).toBeGreaterThan(0);
    for (const obj of parent.objectives) {
      expect(obj.sourceRef.expectedTitle).toBe(obj.title);
      expect(obj.sourceRef.parentLine).toBe(parent.sourceRef.line);
    }
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm test --workspace=server
```

Expected: new test fails — `obj.sourceRef.expectedTitle` is `undefined`.

- [ ] **Step 3: Modify `server/adapters/ObsidianAdapter.js`**

Find the existing `_buildQuest` method and replace the objectives mapping. The current line:

```js
sourceRef: { file: this.file, line: obj.line, parentLine: task.line },
```

becomes:

```js
sourceRef: { file: this.file, line: obj.line, parentLine: task.line, expectedTitle: obj.title },
```

The full block now reads:

```js
const objectives = (task.objectives || []).map((obj, oIdx) => createQuest({
  id: `${id}:obj:${oIdx}`,
  sourceId: 'obsidian',
  sourceRef: { file: this.file, line: obj.line, parentLine: task.line, expectedTitle: obj.title },
  title: obj.title,
  rawLane: lane.name,
  completed: obj.completed,
  completedAt: obj.completedAt,
}));
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm test --workspace=server
```

Expected: 88 tests pass (87 + 1 new).

- [ ] **Step 5: Commit**

```bash
git add server/adapters/ObsidianAdapter.js server/tests/ObsidianAdapter.test.js
git commit -m "feat(adapters): subtask sourceRef carries expectedTitle"
```

---

### Task 3: Extend `ObsidianAdapter.markComplete` for subtasks + transitive parent

**Files:**
- Modify: `server/adapters/ObsidianAdapter.js`
- Modify: `server/tests/ObsidianAdapter.test.js`

- [ ] **Step 1: Write failing tests**

Append to `server/tests/ObsidianAdapter.test.js`:

```js
describe('ObsidianAdapter — markComplete subtask branch', () => {
  test('marking a subtask writes - [x] title without date stamp', async () => {
    const adapter = new ObsidianAdapter({ file: workingFile, vault: 'TestVault' });
    const quests = await adapter.listQuests();
    const parent = quests.find(q => q.title === 'Personal task');
    const subtask = parent.objectives.find(o => o.title === 'Subtask one');

    const result = await adapter.markComplete(subtask.sourceRef);

    const raw = await fs.readFile(workingFile, 'utf8');
    expect(raw).toContain('- [x] Subtask one');
    expect(raw).not.toMatch(/- \[x\] Subtask one ✅/);
    expect(result.parentCompleted).toBe(false);
  });

  test('marking the LAST incomplete subtask also writes parent line with ✅ date', async () => {
    const adapter = new ObsidianAdapter({ file: workingFile, vault: 'TestVault' });
    const quests = await adapter.listQuests();
    const parent = quests.find(q => q.title === 'Personal task');
    // The fixture has Personal task with subtask one (incomplete) + subtask two (complete).
    // So marking 'Subtask one' is the LAST incomplete one.
    const lastIncomplete = parent.objectives.find(o => !o.completed);

    const result = await adapter.markComplete(lastIncomplete.sourceRef);

    const raw = await fs.readFile(workingFile, 'utf8');
    expect(raw).toMatch(/- \[x\] Personal task ✅ \d{4}-\d{2}-\d{2}/);
    expect(result.parentCompleted).toBe(true);
    expect(result.parentLine).toBe(parent.sourceRef.line);
  });

  test('top-level markComplete behavior unchanged (returns parentCompleted: false)', async () => {
    const adapter = new ObsidianAdapter({ file: workingFile, vault: 'TestVault' });
    const quests = await adapter.listQuests();
    const top = quests.find(q => q.title === 'First today task');

    const result = await adapter.markComplete(top.sourceRef);
    const raw = await fs.readFile(workingFile, 'utf8');
    expect(raw).toMatch(/- \[x\] First today task ✅ \d{4}-\d{2}-\d{2}/);
    expect(result.parentCompleted).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm test --workspace=server
```

Expected: new subtask tests fail (markComplete throws when called with a subtask sourceRef — current branch logic doesn't handle parentLine !== null).

- [ ] **Step 3: Modify `server/adapters/ObsidianAdapter.js`**

Add the new helper import at the top:

```js
import { parseBoard, markLineComplete, titleMatches, areAllSubtasksComplete } from '../parsers/kanbanMarkdown.js';
```

Replace the existing `markComplete` method with:

```js
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
    const isSubtask = sourceRef.parentLine !== null && sourceRef.parentLine !== undefined;

    if (!isSubtask) {
      lines[sourceRef.line] = markLineComplete(line, today);
      await fs.writeFile(this.file, lines.join('\n'));
      return { parentCompleted: false };
    }

    // Subtask branch
    lines[sourceRef.line] = markLineComplete(line); // no date stamp
    const allDone = areAllSubtasksComplete(lines, sourceRef.parentLine);
    let parentCompleted = false;
    if (allDone) {
      const parentLineText = lines[sourceRef.parentLine];
      // Only complete parent if it's not already complete
      if (parentLineText && /- \[ \]/.test(parentLineText)) {
        lines[sourceRef.parentLine] = markLineComplete(parentLineText, today);
        parentCompleted = true;
      }
    }
    await fs.writeFile(this.file, lines.join('\n'));
    return { parentCompleted, parentLine: parentCompleted ? sourceRef.parentLine : null };
  } finally {
    await this.lockManager.release(this.file);
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm test --workspace=server
```

Expected: 91 tests pass (88 + 3 new).

- [ ] **Step 5: Commit**

```bash
git add server/adapters/ObsidianAdapter.js server/tests/ObsidianAdapter.test.js
git commit -m "feat(adapters): markComplete handles subtask branch + transitive parent"
```

---

## Phase 2: HTTP Route

### Task 4: Actions route — nested lookup + 422 + parent XP emission

**Files:**
- Modify: `server/routes/actions.js`
- Modify: `server/tests/routes.test.js`

- [ ] **Step 1: Write failing tests**

Append to `server/tests/routes.test.js`:

```js
describe('POST /api/quests/:id/complete — subtasks (v1.1)', () => {
  test('subtask ID resolves via nested lookup and writes subtask line', async () => {
    const { app, tmpDir, aggregator, history } = await buildAppWithActions();
    try {
      const { quests } = await aggregator.collectAll();
      const parent = quests.find(q => q.title === 'Personal task');
      const subtask = parent.objectives.find(o => !o.completed);

      const res = await request(app).post(`/api/quests/${encodeURIComponent(subtask.id)}/complete`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    } finally {
      await fs.rm(tmpDir, { recursive: true, force: true });
    }
  });

  test('completing the last incomplete subtask emits exactly ONE parent XP event', async () => {
    const { app, tmpDir, aggregator, history } = await buildAppWithActions();
    try {
      const { quests } = await aggregator.collectAll();
      const parent = quests.find(q => q.title === 'Personal task');
      const lastIncomplete = parent.objectives.find(o => !o.completed);

      const res = await request(app).post(`/api/quests/${encodeURIComponent(lastIncomplete.id)}/complete`);
      expect(res.status).toBe(200);
      expect(res.body.parentCompleted).toBe(true);
      expect(res.body.xpAwarded).toBe(parent.xp);

      const events = await history.readAll();
      const parentEvents = events.filter(e => e.questId === parent.id);
      expect(parentEvents).toHaveLength(1);
      expect(parentEvents[0].xp).toBe(parent.xp);
    } finally {
      await fs.rm(tmpDir, { recursive: true, force: true });
    }
  });

  test('POST /complete on parent with incomplete subtasks returns 422', async () => {
    const { app, tmpDir, aggregator } = await buildAppWithActions();
    try {
      const { quests } = await aggregator.collectAll();
      const parent = quests.find(q => q.title === 'Personal task');
      // Personal task has 1 incomplete + 1 complete subtask in fixture → blocked.
      const res = await request(app).post(`/api/quests/${encodeURIComponent(parent.id)}/complete`);
      expect(res.status).toBe(422);
      expect(res.body.error).toBe('subtasks_incomplete');
      expect(res.body.remaining).toBeGreaterThan(0);
    } finally {
      await fs.rm(tmpDir, { recursive: true, force: true });
    }
  });

  test('parent with NO subtasks still completes normally (no 422)', async () => {
    const { app, tmpDir, aggregator } = await buildAppWithActions();
    try {
      const { quests } = await aggregator.collectAll();
      const noSubtaskQuest = quests.find(q => q.objectives.length === 0 && !q.completed);
      const res = await request(app).post(`/api/quests/${encodeURIComponent(noSubtaskQuest.id)}/complete`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.parentCompleted).toBeFalsy();
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

Expected: subtask tests fail (current handler can't resolve nested IDs; parent with incomplete subtasks still completes).

- [ ] **Step 3: Modify `server/routes/actions.js`**

Replace the entire file with:

```js
import { Router } from 'express';
import { ConflictError } from '../adapters/SyncAdapter.js';

export function createActionsRoute({ aggregator, adaptersById, history }) {
  const router = Router();

  router.post('/:id/complete', async (req, res, next) => {
    try {
      const { quests } = await aggregator.collectAll();
      const { quest, parent } = findQuestById(quests, req.params.id);
      if (!quest) {
        return res.status(404).json({ error: 'not_found' });
      }
      if (quest.completed) {
        return res.json({ success: true, quest, xpAwarded: 0, parentCompleted: false });
      }

      // Parent-with-incomplete-subtasks → 422
      const isTopLevel = !parent;
      if (isTopLevel && quest.objectives && quest.objectives.length > 0) {
        const remaining = quest.objectives.filter(o => !o.completed).length;
        if (remaining > 0) {
          return res.status(422).json({ error: 'subtasks_incomplete', remaining });
        }
      }

      const adapter = adaptersById[quest.sourceId];
      if (!adapter) {
        return res.status(500).json({ error: 'adapter_missing' });
      }

      let markResult;
      try {
        markResult = await adapter.markComplete(quest.sourceRef);
      } catch (err) {
        if (err instanceof ConflictError || err.code === 'CONFLICT') {
          return res.status(409).json({ error: 'quest_changed', message: err.message });
        }
        throw err;
      }

      // Determine XP awarded + history event
      const isSubtask = !!parent;
      const nowIso = new Date().toISOString();
      let xpAwarded = 0;
      let parentCompleted = false;

      if (!isSubtask) {
        // Top-level completion: award this quest's XP
        await history.appendEvent({
          ts: nowIso,
          questId: quest.id,
          xp: quest.xp,
          source: quest.sourceId,
          title: quest.title,
        });
        xpAwarded = quest.xp;
        const updatedQuest = { ...quest, completed: true, completedAt: nowIso };
        return res.json({ success: true, quest: updatedQuest, xpAwarded, parentCompleted: false });
      }

      // Subtask completion
      if (markResult.parentCompleted) {
        await history.appendEvent({
          ts: nowIso,
          questId: parent.id,
          xp: parent.xp,
          source: parent.sourceId,
          title: parent.title,
        });
        xpAwarded = parent.xp;
        parentCompleted = true;
      }

      const updatedSubtask = { ...quest, completed: true };
      const updatedParent = parentCompleted
        ? { ...parent, completed: true, completedAt: nowIso }
        : undefined;
      return res.json({
        success: true,
        subtask: updatedSubtask,
        xpAwarded,
        parentCompleted,
        parent: updatedParent,
      });
    } catch (err) {
      next(err);
    }
  });

  return router;
}

/**
 * Find a quest by id in the flattened list. If it's a subtask (in some quest's objectives),
 * also return the parent quest.
 * @returns {{quest: Quest|null, parent: Quest|null}}
 */
function findQuestById(quests, id) {
  for (const q of quests) {
    if (q.id === id) return { quest: q, parent: null };
    if (q.objectives) {
      for (const o of q.objectives) {
        if (o.id === id) return { quest: o, parent: q };
      }
    }
  }
  return { quest: null, parent: null };
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm test --workspace=server
```

Expected: 95 tests pass (91 + 4 new). Existing routes tests for top-level completion still pass.

- [ ] **Step 5: Commit**

```bash
git add server/routes/actions.js server/tests/routes.test.js
git commit -m "feat(routes): subtask ID resolution, 422 for blocked parent, transitive parent XP"
```

---

## Phase 3: Client API + Modal

### Task 5: Extend `lib/api.js` to handle 422

**Files:**
- Modify: `client/src/lib/api.js`
- Modify: `client/src/tests/api.test.js`

- [ ] **Step 1: Write failing test**

Append to `client/src/tests/api.test.js`:

```js
describe('postComplete — 422 subtasks_incomplete', () => {
  test('throws SUBTASKS_INCOMPLETE with remaining count', async () => {
    global.fetch.mockResolvedValue({
      ok: false,
      status: 422,
      json: async () => ({ error: 'subtasks_incomplete', remaining: 3 }),
    });
    try {
      await postComplete('q');
      throw new Error('should have thrown');
    } catch (err) {
      expect(err.code).toBe('SUBTASKS_INCOMPLETE');
      expect(err.remaining).toBe(3);
    }
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm test --workspace=client
```

Expected: new test fails (current handler throws generic `Error(422)`).

- [ ] **Step 3: Modify `client/src/lib/api.js`**

Replace the `postComplete` function with:

```js
export async function postComplete(questId) {
  const res = await fetch(`/api/quests/${encodeURIComponent(questId)}/complete`, { method: 'POST' });
  if (!res.ok) {
    if (res.status === 409) {
      const err = new Error('quest_changed');
      err.code = 'CONFLICT';
      throw err;
    }
    if (res.status === 422) {
      const body = await res.json().catch(() => ({}));
      const err = new Error('subtasks_incomplete');
      err.code = 'SUBTASKS_INCOMPLETE';
      err.remaining = body.remaining;
      throw err;
    }
    throw new Error(`postComplete failed: ${res.status}`);
  }
  return res.json();
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm test --workspace=client
```

Expected: 26 client tests pass (25 + 1 new).

- [ ] **Step 5: Commit**

```bash
git add client/src/lib/api.js client/src/tests/api.test.js
git commit -m "feat(client): postComplete throws SUBTASKS_INCOMPLETE on 422"
```

---

### Task 6: QuestModal — clickable subtasks, ObjectivesBar inside, parent button disabled

**Files:**
- Modify: `client/src/components/QuestModal.jsx`
- Modify: `client/src/tests/QuestModal.test.jsx`

- [ ] **Step 1: Write failing tests**

Replace the entire content of `client/src/tests/QuestModal.test.jsx` with:

```jsx
import { describe, test, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { QuestModal } from '../components/QuestModal.jsx';

const baseQuest = {
  id: 'q1',
  title: 'Apply to Vercel',
  xp: 35,
  xpSource: 'auto',
  flags: [],
  category: 'Job Hunt',
  rawLane: '🚀 JOB SEARCH - SAAS COMPANIES',
  deepLink: 'obsidian://open?vault=V&file=board',
  objectives: [],
};

const questWithSubtasks = {
  ...baseQuest,
  objectives: [
    { id: 'q1:obj:0', title: 'Submit application', completed: false },
    { id: 'q1:obj:1', title: 'Send follow-up', completed: true },
  ],
};

describe('QuestModal — header + actions (unchanged behaviors)', () => {
  test('renders title, category, source attribution', () => {
    render(<QuestModal quest={questWithSubtasks} onClose={() => {}} onComplete={() => {}} onObjectiveComplete={() => {}} />);
    expect(screen.getByText('Apply to Vercel')).toBeInTheDocument();
    expect(screen.getByText(/Job Hunt/)).toBeInTheDocument();
    expect(screen.getByText(/JOB SEARCH - SAAS/)).toBeInTheDocument();
  });

  test('"Open in Obsidian" anchor points to deepLink', () => {
    render(<QuestModal quest={questWithSubtasks} onClose={() => {}} onComplete={() => {}} onObjectiveComplete={() => {}} />);
    const link = screen.getByRole('link', { name: /open in obsidian/i });
    expect(link).toHaveAttribute('href', questWithSubtasks.deepLink);
  });

  test('Escape key closes modal', () => {
    const onClose = vi.fn();
    render(<QuestModal quest={questWithSubtasks} onClose={onClose} onComplete={() => {}} onObjectiveComplete={() => {}} />);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });
});

describe('QuestModal — objectives section', () => {
  test('renders ObjectivesBar above the subtask list when objectives exist', () => {
    render(<QuestModal quest={questWithSubtasks} onClose={() => {}} onComplete={() => {}} onObjectiveComplete={() => {}} />);
    // ObjectivesBar shows done/total label
    expect(screen.getByText(/1\/2/)).toBeInTheDocument();
    // Subtasks are present
    expect(screen.getByText('Submit application')).toBeInTheDocument();
    expect(screen.getByText('Send follow-up')).toBeInTheDocument();
  });

  test('no ObjectivesBar when quest has no objectives', () => {
    render(<QuestModal quest={baseQuest} onClose={() => {}} onComplete={() => {}} onObjectiveComplete={() => {}} />);
    // ObjectivesBar shows done/total label
    expect(screen.queryByText(/\d+\/\d+/)).not.toBeInTheDocument();
  });

  test('clicking an unchecked subtask fires onObjectiveComplete with the subtask', () => {
    const onObjectiveComplete = vi.fn();
    render(<QuestModal quest={questWithSubtasks} onClose={() => {}} onComplete={() => {}} onObjectiveComplete={onObjectiveComplete} />);
    fireEvent.click(screen.getByRole('button', { name: /submit application/i }));
    expect(onObjectiveComplete).toHaveBeenCalledTimes(1);
    expect(onObjectiveComplete.mock.calls[0][0].id).toBe('q1:obj:0');
  });

  test('completed subtask is not a button (not clickable)', () => {
    render(<QuestModal quest={questWithSubtasks} onClose={() => {}} onComplete={() => {}} onObjectiveComplete={() => {}} />);
    expect(screen.queryByRole('button', { name: /send follow-up/i })).toBeNull();
    // The text is still visible
    expect(screen.getByText('Send follow-up')).toBeInTheDocument();
  });

  test('ObjectivesBar reflects optimistic update after subtask click', () => {
    render(<QuestModal quest={questWithSubtasks} onClose={() => {}} onComplete={() => {}} onObjectiveComplete={() => {}} />);
    // Initial 1/2
    expect(screen.getByText(/1\/2/)).toBeInTheDocument();
    // Click the incomplete subtask
    fireEvent.click(screen.getByRole('button', { name: /submit application/i }));
    // Now 2/2
    expect(screen.getByText(/2\/2/)).toBeInTheDocument();
  });
});

describe('QuestModal — parent "Mark Complete" button', () => {
  test('disabled when subtasks remain incomplete', () => {
    render(<QuestModal quest={questWithSubtasks} onClose={() => {}} onComplete={() => {}} onObjectiveComplete={() => {}} />);
    const btn = screen.getByRole('button', { name: /mark complete/i });
    expect(btn).toBeDisabled();
    expect(screen.getByText(/Complete all objectives first/i)).toBeInTheDocument();
  });

  test('enabled when quest has no objectives', () => {
    const onComplete = vi.fn();
    render(<QuestModal quest={baseQuest} onClose={() => {}} onComplete={onComplete} onObjectiveComplete={() => {}} />);
    const btn = screen.getByRole('button', { name: /mark complete/i });
    expect(btn).not.toBeDisabled();
    fireEvent.click(btn);
    expect(onComplete).toHaveBeenCalledWith(baseQuest);
  });

  test('enabled when all objectives are complete (e.g., completed externally)', () => {
    const allDone = {
      ...questWithSubtasks,
      objectives: [
        { id: 'q1:obj:0', title: 'a', completed: true },
        { id: 'q1:obj:1', title: 'b', completed: true },
      ],
    };
    render(<QuestModal quest={allDone} onClose={() => {}} onComplete={() => {}} onObjectiveComplete={() => {}} />);
    const btn = screen.getByRole('button', { name: /mark complete/i });
    expect(btn).not.toBeDisabled();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm test --workspace=client
```

Expected: new objectives + parent-button tests fail (current modal has no clickable subtasks, no internal ObjectivesBar, no disabled state).

- [ ] **Step 3: Replace `client/src/components/QuestModal.jsx` with**:

```jsx
import { useEffect, useState, useMemo } from 'react';
import { XpBadge } from './XpBadge.jsx';
import { ObjectivesBar } from './ObjectivesBar.jsx';

export function QuestModal({ quest, onClose, onComplete, onObjectiveComplete }) {
  const [liveObjectives, setLiveObjectives] = useState(quest.objectives || []);

  useEffect(() => {
    setLiveObjectives(quest.objectives || []);
  }, [quest.objectives]);

  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const liveDone = useMemo(() => liveObjectives.filter(o => o.completed).length, [liveObjectives]);
  const liveTotal = liveObjectives.length;
  const hasObjectives = liveTotal > 0;
  const allDone = hasObjectives && liveDone === liveTotal;
  const parentButtonDisabled = hasObjectives && !allDone;

  const handleObjectiveClick = (obj) => {
    // Optimistic update
    setLiveObjectives(prev =>
      prev.map(o => (o.id === obj.id ? { ...o, completed: true } : o))
    );
    onObjectiveComplete(obj);
  };

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

        {hasObjectives && (
          <div className="my-4">
            <p className="text-xs uppercase tracking-widest opacity-70 mb-2">Objectives</p>
            <ObjectivesBar done={liveDone} total={liveTotal} />
            <ul className="space-y-1 mt-3">
              {liveObjectives.map(obj => (
                <li key={obj.id} className="text-sm">
                  {obj.completed ? (
                    <span className="flex items-center gap-2">
                      <span aria-hidden>☑</span>
                      <span className="line-through opacity-60">{obj.title}</span>
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleObjectiveClick(obj)}
                      className="flex items-center gap-2 text-left w-full hover:text-hud-success"
                    >
                      <span aria-hidden>☐</span>
                      <span>{obj.title}</span>
                    </button>
                  )}
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
            onClick={() => !parentButtonDisabled && onComplete(quest)}
            disabled={parentButtonDisabled}
            className={`flex-1 px-3 py-2 font-bold uppercase tracking-widest text-xs ${
              parentButtonDisabled
                ? 'bg-hud-border text-hud-bg/50 cursor-not-allowed'
                : 'bg-hud-accent text-hud-bg hover:brightness-110'
            }`}
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

        {parentButtonDisabled && (
          <p className="mt-2 text-[10px] uppercase tracking-widest opacity-70 text-center">
            Complete all objectives first ({liveDone}/{liveTotal})
          </p>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm test --workspace=client
```

Expected: 36 client tests pass (existing tests adapt to the new prop `onObjectiveComplete` which the test file now passes; new tests pass).

- [ ] **Step 5: Commit**

```bash
git add client/src/components/QuestModal.jsx client/src/tests/QuestModal.test.jsx
git commit -m "feat(client): QuestModal interactive subtasks + parent button gating"
```

---

### Task 7: Wire `App.jsx` to handle subtask completion responses

**Files:**
- Modify: `client/src/App.jsx`

- [ ] **Step 1: Replace `client/src/App.jsx` content**

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
        // Parent transitively completed — close modal, big XP toast
        setSelectedQuest(null);
        showToast('success', `+${res.xpAwarded} XP — ${res.parent?.title ?? 'Quest complete'}`);
        await Promise.all([refetch(), refetchHistory()]);
      } else {
        // Subtask completed, parent still in progress — small toast, keep modal open, refetch in background
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

- [ ] **Step 2: Run all client tests + production build**

```bash
npm test --workspace=client
npm run build --workspace=client
```

Expected: all client tests pass. `vite build` succeeds.

- [ ] **Step 3: Commit**

```bash
git add client/src/App.jsx
git commit -m "feat(client): wire App with onObjectiveComplete for v1.1 subtask flow"
```

---

## Phase 4: Verification

### Task 8: Manual smoke test against fixture + production build verification

**Files:** none modified (verification only)

- [ ] **Step 1: Run all server + client tests**

```bash
npm test --workspace=server
npm test --workspace=client
```

Expected: 95 server tests + 36 client tests = 131 total passing.

- [ ] **Step 2: Production build**

```bash
npm run build --workspace=client
```

Expected: `vite build` succeeds. `client/dist/` regenerated.

- [ ] **Step 3: Boot prod server against the test fixture and exercise subtask flow via HTTP**

```bash
# Ensure config points at the fixture for this smoke test
cat > config/sources.json <<'JSON'
{
  "sources": [
    {
      "id": "obsidian",
      "adapter": "ObsidianAdapter",
      "config": {
        "file": "<repo-root>/server/tests/fixtures/sample-board.md",
        "vault": "TestVault"
      },
      "pollIntervalSec": 60
    }
  ]
}
JSON

# Fresh history
rm -f data/.backfilled-obsidian data/xp-history.jsonl

# Reset fixture in case prior tests mutated it (test fixtures live under git)
git checkout server/tests/fixtures/sample-board.md

# Boot
node server/index.js > /tmp/qd-v11.log 2>&1 &
SERVER_PID=$!
sleep 1.5

# Grab the Personal task parent ID and its incomplete subtask ID
QUESTS=$(curl -s http://localhost:3000/api/quests)
echo "$QUESTS" | python3 -c "
import sys, json
d = json.load(sys.stdin)
parent = next(q for q in d['quests'] if q['title'] == 'Personal task')
incomplete = next(o for o in parent['objectives'] if not o['completed'])
print('PARENT_ID=' + parent['id'])
print('PARENT_XP=' + str(parent['xp']))
print('SUBTASK_ID=' + incomplete['id'])
" > /tmp/qd-ids.sh
cat /tmp/qd-ids.sh
source /tmp/qd-ids.sh

echo "=== POST on PARENT (should 422 because 1 subtask incomplete) ==="
curl -s -o /tmp/qd-422.json -w "HTTP %{http_code}\n" -X POST "http://localhost:3000/api/quests/${PARENT_ID}/complete"
cat /tmp/qd-422.json
echo

echo "=== POST on SUBTASK (should 200 + parentCompleted: true) ==="
curl -s -o /tmp/qd-200.json -w "HTTP %{http_code}\n" -X POST "http://localhost:3000/api/quests/${SUBTASK_ID}/complete"
cat /tmp/qd-200.json
echo

echo "=== xp-history.jsonl ==="
cat data/xp-history.jsonl

# Restore fixture and cleanup
kill $SERVER_PID 2>/dev/null
wait $SERVER_PID 2>/dev/null
git checkout server/tests/fixtures/sample-board.md
rm -f data/.backfilled-obsidian data/xp-history.jsonl
```

Expected output:
- The 422 response includes `"error":"subtasks_incomplete","remaining":1`
- The 200 response includes `"success":true`, `"parentCompleted":true`, `"xpAwarded":<parent's XP>`
- `xp-history.jsonl` contains exactly ONE event for the parent quest (matching PARENT_XP)
- Fixture is restored to original state

- [ ] **Step 4: Update top-level docs cross-references (one-line edits)**

In `docs/SPEC.md`, add a reference at the top:

```markdown
**See also**: [SPEC-v1.1-subtasks.md](SPEC-v1.1-subtasks.md) for the v1.1 amendments (interactive subtasks).
```

In `docs/IMPLEMENTATION-PLAN.md`, add a note at the top:

```markdown
> **v1.1 follow-on**: See [IMPLEMENTATION-PLAN-v1.1-subtasks.md](IMPLEMENTATION-PLAN-v1.1-subtasks.md) for interactive-subtask work that ships on top of v1.
```

- [ ] **Step 5: Commit**

```bash
git add docs/SPEC.md docs/IMPLEMENTATION-PLAN.md
git commit -m "docs: cross-link v1 specs/plans to v1.1 amendments"
```

- [ ] **Step 6: User-driven manual smoke test in browser**

(This step is interactive — controller hands off to user.)

Run `npm run dev`, open `http://localhost:5173/`, then in the dashboard:
1. Find a quest with subtasks. Open its modal.
2. Confirm the `ObjectivesBar` appears just above the subtask checklist.
3. Confirm the parent's "Mark Complete" button is disabled with the helper text.
4. Click an unchecked subtask → it ticks instantly (optimistic) → progress bar fills → small toast appears → file updates in Obsidian.
5. Tick the LAST remaining subtask → modal closes → big XP toast fires → daily/weekly bars animate → parent line shows `- [x] ... ✅ <today>` in Obsidian.
6. Open a quest with NO subtasks → parent's "Mark Complete" button is enabled → completion still works as in v1.

---

## Self-Review Checklist

- [ ] **Spec coverage** — every v1.1 spec section maps to a task:
  - §2.1 Subtask click semantics → Tasks 3, 6, 7
  - §2.2 Parent auto-completion → Tasks 3, 4
  - §2.3 Parent button gating → Task 6
  - §2.4 Modal ObjectivesBar → Task 6
  - §3.1 API extensions → Tasks 4, 5
  - §3.2 Quest schema additions → Task 2
  - §4 Adapter changes → Tasks 1, 3
  - §5 Frontend changes → Tasks 5, 6, 7
  - §6 Conflict + Error handling → Tasks 4, 7
  - §7 Tests → distributed across each task
- [ ] **All tests passing** (server + client)
- [ ] **Production build succeeds**
- [ ] **Manual smoke test (Step 6) confirms end-to-end behavior**
