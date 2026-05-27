import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';
import { loadConfig } from '../core/configLoader.js';

let rootDir;

beforeEach(async () => {
  rootDir = await fs.mkdtemp(path.join(os.tmpdir(), 'cl-'));
});

afterEach(async () => {
  await fs.rm(rootDir, { recursive: true, force: true });
});

describe('loadConfig — graceful missing config', () => {
  test('returns empty sources when sources.json is missing', async () => {
    const { sources, targets } = await loadConfig(rootDir);
    expect(sources).toEqual({ sources: [] });
    expect(targets).toEqual({ daily: 50, weekly: 250 });
  });

  test('returns parsed sources when sources.json exists', async () => {
    const configDir = path.join(rootDir, 'config');
    await fs.mkdir(configDir, { recursive: true });
    const payload = { sources: [{ id: 'obsidian', adapter: 'X', config: {}, pollIntervalSec: 60 }] };
    await fs.writeFile(path.join(configDir, 'sources.json'), JSON.stringify(payload));
    const { sources } = await loadConfig(rootDir);
    expect(sources).toEqual(payload);
  });

  test('still throws on malformed JSON in sources.json', async () => {
    const configDir = path.join(rootDir, 'config');
    await fs.mkdir(configDir, { recursive: true });
    await fs.writeFile(path.join(configDir, 'sources.json'), '{not valid json');
    await expect(loadConfig(rootDir)).rejects.toThrow();
  });
});
