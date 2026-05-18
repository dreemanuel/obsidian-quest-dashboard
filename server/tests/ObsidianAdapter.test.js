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
    // sample-board has: TO DO TODAY (2 tasks) + DEV-PERSONAL (2 tasks) + Archive (1 task) = 5 top-level
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
