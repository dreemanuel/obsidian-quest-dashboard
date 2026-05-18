import { describe, test, expect } from 'vitest';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { parseBoard, markLineComplete, titleMatches } from '../parsers/kanbanMarkdown.js';

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
