import { promises as fs } from 'fs';
import path from 'path';

export async function loadConfig(rootDir) {
  const configDir = path.join(rootDir, 'config');
  const sourcesPath = path.join(configDir, 'sources.json');
  const targetsPath = path.join(configDir, 'targets.json');

  const [sources, targets] = await Promise.all([
    readJsonOrDefault(sourcesPath, { sources: [] }),
    readJsonOrDefault(targetsPath, { daily: 50, weekly: 250 }),
  ]);

  return { sources, targets };
}

async function readJsonOrDefault(filePath, defaultValue) {
  try {
    const raw = await fs.readFile(filePath, 'utf8');
    return JSON.parse(raw);
  } catch (err) {
    if (err.code === 'ENOENT') return defaultValue;
    throw err;
  }
}
