import { describe, test, expect, vi, beforeEach } from 'vitest';
import { fetchQuests, fetchHistory, postComplete } from '../lib/api.js';

beforeEach(() => {
  global.fetch = vi.fn();
});

describe('fetchQuests', () => {
  test('GETs /api/quests and returns JSON', async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({ quests: [], categories: [] }),
    });
    const result = await fetchQuests();
    expect(global.fetch).toHaveBeenCalledWith('/api/quests');
    expect(result.quests).toEqual([]);
  });

  test('throws on non-ok response', async () => {
    global.fetch.mockResolvedValue({ ok: false, status: 500 });
    await expect(fetchQuests()).rejects.toThrow('500');
  });
});

describe('postComplete', () => {
  test('POSTs to /api/quests/:id/complete', async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ success: true, xpAwarded: 25 }),
    });
    const result = await postComplete('quest-id-1');
    expect(global.fetch).toHaveBeenCalledWith('/api/quests/quest-id-1/complete', { method: 'POST' });
    expect(result.success).toBe(true);
  });

  test('throws Conflict on 409', async () => {
    global.fetch.mockResolvedValue({ ok: false, status: 409, json: async () => ({ error: 'quest_changed' }) });
    await expect(postComplete('q')).rejects.toMatchObject({ code: 'CONFLICT' });
  });
});

describe('fetchHistory', () => {
  test('GETs /api/history', async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({ today: { xp: 50 }, week: { xp: 200 }, streak: 3 }),
    });
    const result = await fetchHistory();
    expect(global.fetch).toHaveBeenCalledWith('/api/history');
    expect(result.streak).toBe(3);
  });
});

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
