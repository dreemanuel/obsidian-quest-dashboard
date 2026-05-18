import { promises as fs } from 'fs';
import path from 'path';

const DEFAULT_MAX_AGE_MS = 5000;
const DEFAULT_RETRY_MS = 100;

export function createLockManager() {
  return {
    async acquire(targetFile, opts = {}) {
      const maxAgeMs = opts.maxAgeMs ?? DEFAULT_MAX_AGE_MS;
      const retries = opts.retries ?? 1;
      const lockPath = lockPathFor(targetFile);

      for (let attempt = 0; attempt <= retries; attempt++) {
        try {
          const payload = JSON.stringify({ pid: process.pid, acquiredAt: new Date().toISOString() });
          await fs.writeFile(lockPath, payload, { flag: 'wx' });
          return;
        } catch (err) {
          if (err.code !== 'EEXIST') throw err;
          // Lock exists — check if stale
          const isStale = await checkStale(lockPath, maxAgeMs);
          if (isStale) {
            await fs.unlink(lockPath).catch(() => {});
            continue;
          }
          if (attempt === retries) {
            const lockErr = new Error('LOCK_BUSY');
            lockErr.code = 'LOCK_BUSY';
            throw lockErr;
          }
          await sleep(DEFAULT_RETRY_MS);
        }
      }
    },

    async release(targetFile) {
      const lockPath = lockPathFor(targetFile);
      await fs.unlink(lockPath).catch((err) => {
        if (err.code !== 'ENOENT') throw err;
      });
    },
  };
}

function lockPathFor(targetFile) {
  const dir = path.dirname(targetFile);
  const base = path.basename(targetFile);
  return path.join(dir, `.${base}.lock`);
}

async function checkStale(lockPath, maxAgeMs) {
  try {
    const raw = await fs.readFile(lockPath, 'utf8');
    const { acquiredAt } = JSON.parse(raw);
    const age = Date.now() - new Date(acquiredAt).getTime();
    return age > maxAgeMs;
  } catch {
    return true;
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
