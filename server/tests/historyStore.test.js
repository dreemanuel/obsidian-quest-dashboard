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
      { questId: '3', xp: 30, ts: '2026-05-18T10:00:00Z', source: 'o', title: 'c' },
    ]);
    expect(await store.streakDays(new Date('2026-05-18T23:00:00Z'))).toBe(1);
  });
});

describe('historyStore — dailyXpByDate', () => {
  test('sums XP per ISO date across events in the window', async () => {
    const store = createHistoryStore(storePath);
    await store.appendBatch([
      { questId: 'a', xp: 10, ts: '2026-05-18T10:00:00Z', source: 'o', title: 'a' },
      { questId: 'b', xp: 25, ts: '2026-05-18T15:30:00Z', source: 'o', title: 'b' },
      { questId: 'c', xp: 30, ts: '2026-05-19T09:00:00Z', source: 'o', title: 'c' },
    ]);
    const map = await store.dailyXpByDate(
      new Date('2026-05-18T00:00:00Z'),
      new Date('2026-05-20T23:59:59Z')
    );
    expect(map.get('2026-05-18')).toBe(35);
    expect(map.get('2026-05-19')).toBe(30);
    expect(map.size).toBe(2);
  });

  test('returns empty Map when no events in range', async () => {
    const store = createHistoryStore(storePath);
    await store.appendEvent({ questId: 'q1', xp: 10, ts: '2026-01-01T10:00:00Z', source: 'o', title: 't' });
    const map = await store.dailyXpByDate(
      new Date('2026-05-01T00:00:00Z'),
      new Date('2026-05-31T23:59:59Z')
    );
    expect(map.size).toBe(0);
  });

  test('excludes events outside the window', async () => {
    const store = createHistoryStore(storePath);
    await store.appendBatch([
      { questId: 'before', xp: 10, ts: '2026-05-17T10:00:00Z', source: 'o', title: 'b' },
      { questId: 'in', xp: 20, ts: '2026-05-18T10:00:00Z', source: 'o', title: 'i' },
      { questId: 'after', xp: 30, ts: '2026-05-19T10:00:00Z', source: 'o', title: 'a' },
    ]);
    const map = await store.dailyXpByDate(
      new Date('2026-05-18T00:00:00Z'),
      new Date('2026-05-18T23:59:59Z')
    );
    expect(map.size).toBe(1);
    expect(map.get('2026-05-18')).toBe(20);
  });

  test('returns empty Map when log file does not exist', async () => {
    const store = createHistoryStore(storePath);
    const map = await store.dailyXpByDate(
      new Date('2026-05-01T00:00:00Z'),
      new Date('2026-05-31T23:59:59Z')
    );
    expect(map.size).toBe(0);
  });
});
