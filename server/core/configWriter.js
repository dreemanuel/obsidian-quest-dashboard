import { promises as fs } from 'fs';
import path from 'path';

/**
 * Atomically write the sources config to `<rootDir>/config/sources.json`.
 * Writes to `<file>.tmp` first, then renames into place — so a crash mid-write
 * leaves the original config untouched.
 *
 * @param {string} rootDir Project root (parent of config/)
 * @param {Array} sources Array of source descriptors
 */
export async function writeSourcesConfig(rootDir, sources) {
  const configDir = path.join(rootDir, 'config');
  await fs.mkdir(configDir, { recursive: true });
  const target = path.join(configDir, 'sources.json');
  const tmp = `${target}.tmp`;
  const payload = JSON.stringify({ sources }, null, 2) + '\n';
  await fs.writeFile(tmp, payload, 'utf8');
  await fs.rename(tmp, target);
}
