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
