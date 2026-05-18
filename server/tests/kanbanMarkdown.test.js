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
