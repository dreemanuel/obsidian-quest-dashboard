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
