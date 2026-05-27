import { describe, test, expect, vi, beforeEach } from 'vitest';
import { getSetupStatus, browse, scanVault, saveSources } from '../lib/setupApi.js';

beforeEach(() => {
  global.fetch = vi.fn();
});

describe('getSetupStatus', () => {
  test('GETs /api/setup/status', async () => {
    global.fetch.mockResolvedValue({ ok: true, json: async () => ({ setupNeeded: true, sources: [] }) });
    const result = await getSetupStatus();
    expect(global.fetch).toHaveBeenCalledWith('/api/setup/status');
    expect(result.setupNeeded).toBe(true);
  });
});

describe('browse', () => {
  test('GETs /api/setup/browse with path + mode', async () => {
    global.fetch.mockResolvedValue({ ok: true, json: async () => ({ entries: [], parent: null, resolvedPath: '/' }) });
    await browse({ path: '/home/user', mode: 'files' });
    expect(global.fetch).toHaveBeenCalledWith('/api/setup/browse?path=%2Fhome%2Fuser&mode=files');
  });

  test('throws PATH_OUT_OF_BOUNDS on 403', async () => {
    global.fetch.mockResolvedValue({ ok: false, status: 403, json: async () => ({ error: 'path_out_of_bounds' }) });
    await expect(browse({ path: '/etc', mode: 'files' })).rejects.toMatchObject({ code: 'PATH_OUT_OF_BOUNDS' });
  });
});

describe('scanVault', () => {
  test('POSTs to /api/setup/scan-vault', async () => {
    global.fetch.mockResolvedValue({ ok: true, json: async () => ({ vaultName: 'V', boards: [], truncated: false }) });
    await scanVault('/home/user/V');
    expect(global.fetch).toHaveBeenCalledWith('/api/setup/scan-vault', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: '/home/user/V' }),
    });
  });
});

describe('saveSources', () => {
  test('POSTs sources array', async () => {
    global.fetch.mockResolvedValue({ ok: true, json: async () => ({ saved: true, sourceCount: 1 }) });
    const sources = [{ id: 'x', adapter: 'ObsidianAdapter', config: { file: '/f.md', vault: 'V' }, pollIntervalSec: 60 }];
    await saveSources(sources);
    expect(global.fetch).toHaveBeenCalledWith('/api/setup/save-sources', expect.objectContaining({
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    }));
  });

  test('throws VALIDATION_ERROR on 400 with errors payload', async () => {
    global.fetch.mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({ saved: false, errors: [{ index: 0, error: 'invalid_kanban' }] }),
    });
    try {
      await saveSources([]);
      throw new Error('should have thrown');
    } catch (err) {
      expect(err.code).toBe('VALIDATION_ERROR');
      expect(err.errors).toHaveLength(1);
    }
  });
});
