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

    // Externally mark a quest complete in the original fixture
    let raw = await fs.readFile(workingFile, 'utf8');
    raw = raw.replace('- [ ] First today task', '- [x] First today task ✅ 2026-05-27');
    await fs.writeFile(workingFile, raw);

    // Put adapter back; first call should re-seed snapshot WITHOUT firing
    // a spurious completion event (the change happened while no adapter was active).
    agg.replaceAdapters([adapter]);
    await agg.collectAll();
    const eventsAfter = await history.readAll();
    expect(eventsAfter).toHaveLength(0);
  });
});
