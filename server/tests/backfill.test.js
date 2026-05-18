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
