import { promises as fs } from 'fs';
import path from 'path';

export async function loadConfig(rootDir) {
  const configDir = path.join(rootDir, 'config');
  const sourcesPath = path.join(configDir, 'sources.json');
  const targetsPath = path.join(configDir, 'targets.json');

  const [sources, targets] = await Promise.all([
    readJsonOrThrow(sourcesPath, 'sources.json is required'),
    readJsonOrDefault(targetsPath, { daily: 50, weekly: 250 }),
  ]);

  return { sources, targets };
}

async function readJsonOrThrow(filePath, errMsg) {
  try {
    return JSON.parse(await fs.readFile(filePath, 'utf8'));
  } catch (err) {
    if (err.code === 'ENOENT') {
      throw new Error(`${errMsg} — expected at ${filePath}`);
    }
    throw err;
  }
}

async function readJsonOrDefault(filePath, defaultValue) {
  try {
    return JSON.parse(await fs.readFile(filePath, 'utf8'));
  } catch (err) {
    if (err.code === 'ENOENT') return defaultValue;
    throw err;
  }
}
