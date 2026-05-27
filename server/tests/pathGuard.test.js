import { describe, test, expect, beforeAll, afterAll } from 'vitest';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';
import { assertPathSafe } from '../core/pathGuard.js';

const HOME = os.homedir();

describe('assertPathSafe', () => {
  test('accepts a path inside HOME', async () => {
    const inside = path.join(HOME, 'Documents');
    const result = await assertPathSafe(inside);
    expect(result).toBe(path.resolve(inside));
  });

  test('rejects a path outside HOME', async () => {
    await expect(assertPathSafe('/etc/passwd')).rejects.toMatchObject({ code: 'PATH_OUT_OF_BOUNDS' });
  });

  test('rejects path containing .. segments after resolve escape', async () => {
    const escape = path.join(HOME, '..', '..', 'etc');
    await expect(assertPathSafe(escape)).rejects.toMatchObject({ code: 'PATH_OUT_OF_BOUNDS' });
  });

  test('resolves symlink before bounds check', async () => {
    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'pg-'));
    const sym = path.join(HOME, `pg-sym-${Date.now()}`);
    try {
      await fs.symlink(tmp, sym);
      await expect(assertPathSafe(sym)).rejects.toMatchObject({ code: 'PATH_OUT_OF_BOUNDS' });
    } finally {
      await fs.unlink(sym).catch(() => {});
      await fs.rm(tmp, { recursive: true, force: true });
    }
  });

  test('rejects non-existent path with PATH_NOT_FOUND', async () => {
    const missing = path.join(HOME, `does-not-exist-${Date.now()}`);
    await expect(assertPathSafe(missing)).rejects.toMatchObject({ code: 'PATH_NOT_FOUND' });
  });
});
