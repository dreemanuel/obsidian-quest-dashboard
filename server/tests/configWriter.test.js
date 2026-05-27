import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';
import { writeSourcesConfig } from '../core/configWriter.js';

let rootDir;

beforeEach(async () => {
  rootDir = await fs.mkdtemp(path.join(os.tmpdir(), 'cw-'));
});

afterEach(async () => {
  await fs.rm(rootDir, { recursive: true, force: true });
});

describe('writeSourcesConfig', () => {
  test('creates config/sources.json with the given sources array', async () => {
    const sources = [
      { id: 'obsidian', adapter: 'ObsidianAdapter', config: { file: '/x/y.md', vault: 'V' }, pollIntervalSec: 60 },
    ];
    await writeSourcesConfig(rootDir, sources);
    const raw = await fs.readFile(path.join(rootDir, 'config', 'sources.json'), 'utf8');
    expect(JSON.parse(raw)).toEqual({ sources });
  });

  test('overwrites existing config atomically (no .tmp file remains)', async () => {
    const configDir = path.join(rootDir, 'config');
    await fs.mkdir(configDir, { recursive: true });
    await fs.writeFile(path.join(configDir, 'sources.json'), JSON.stringify({ sources: [{ id: 'old' }] }));
    await writeSourcesConfig(rootDir, [{ id: 'new', adapter: 'X', config: {}, pollIntervalSec: 60 }]);
    const raw = await fs.readFile(path.join(configDir, 'sources.json'), 'utf8');
    expect(JSON.parse(raw).sources[0].id).toBe('new');
    const entries = await fs.readdir(configDir);
    expect(entries.filter(e => e.endsWith('.tmp'))).toHaveLength(0);
  });

  test('creates config/ directory if missing', async () => {
    await writeSourcesConfig(rootDir, []);
    const stat = await fs.stat(path.join(rootDir, 'config'));
    expect(stat.isDirectory()).toBe(true);
  });

  test('writes empty sources array cleanly', async () => {
    await writeSourcesConfig(rootDir, []);
    const raw = await fs.readFile(path.join(rootDir, 'config', 'sources.json'), 'utf8');
    expect(JSON.parse(raw)).toEqual({ sources: [] });
  });
});
