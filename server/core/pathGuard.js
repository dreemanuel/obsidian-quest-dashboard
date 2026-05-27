import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';

/**
 * Canonicalize an input path, then assert it lies inside the user's home dir.
 * Resolves symlinks before the bounds check.
 *
 * Throws:
 *  - { code: 'PATH_NOT_FOUND' } if the path doesn't exist
 *  - { code: 'PATH_OUT_OF_BOUNDS' } if the canonical path escapes $HOME
 *  - { code: 'PATH_INVALID' } for other I/O errors during resolution
 *
 * Returns: the canonical absolute path on success.
 */
export async function assertPathSafe(input) {
  const home = os.homedir();
  let canonical;
  try {
    const resolved = path.resolve(input);
    canonical = await fs.realpath(resolved);
  } catch (err) {
    if (err.code === 'ENOENT') {
      const e = new Error(`PATH_NOT_FOUND: ${input}`);
      e.code = 'PATH_NOT_FOUND';
      throw e;
    }
    const e = new Error(`PATH_INVALID: ${err.message}`);
    e.code = 'PATH_INVALID';
    throw e;
  }
  const homeCanonical = await fs.realpath(home);
  const rel = path.relative(homeCanonical, canonical);
  if (rel.startsWith('..') || path.isAbsolute(rel)) {
    const e = new Error(`PATH_OUT_OF_BOUNDS: ${canonical}`);
    e.code = 'PATH_OUT_OF_BOUNDS';
    throw e;
  }
  return canonical;
}
