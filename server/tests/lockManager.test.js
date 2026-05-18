import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';
import { createLockManager } from '../core/lockManager.js';

let tmpDir;
let targetFile;

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'qd-lock-'));
  targetFile = path.join(tmpDir, 'target.md');
  await fs.writeFile(targetFile, 'content');
});

afterEach(async () => {
  await fs.rm(tmpDir, { recursive: true, force: true });
});

describe('lockManager', () => {
  test('acquire creates a .lock file beside the target', async () => {
    const lock = createLockManager();
    await lock.acquire(targetFile);
    const lockPath = path.join(tmpDir, '.target.md.lock');
    const stat = await fs.stat(lockPath);
    expect(stat.isFile()).toBe(true);
    await lock.release(targetFile);
  });

  test('release removes the .lock file', async () => {
    const lock = createLockManager();
    await lock.acquire(targetFile);
    await lock.release(targetFile);
    const lockPath = path.join(tmpDir, '.target.md.lock');
    await expect(fs.stat(lockPath)).rejects.toMatchObject({ code: 'ENOENT' });
  });

  test('acquire on already-locked file throws LockBusyError', async () => {
    const lock = createLockManager();
    await lock.acquire(targetFile);
    await expect(lock.acquire(targetFile, { retries: 0 })).rejects.toThrow('LOCK_BUSY');
    await lock.release(targetFile);
  });

  test('stale lock (older than maxAgeMs) is forcibly acquired', async () => {
    const lock = createLockManager();
    const lockPath = path.join(tmpDir, '.target.md.lock');
    const stalePayload = JSON.stringify({ pid: 99999, acquiredAt: new Date(Date.now() - 10_000).toISOString() });
    await fs.writeFile(lockPath, stalePayload);
    await lock.acquire(targetFile, { maxAgeMs: 5000 });
    await lock.release(targetFile);
  });
});
