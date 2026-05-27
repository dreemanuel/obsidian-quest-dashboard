import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';
import express from 'express';
import request from 'supertest';
import { createSetupRoute } from '../routes/setup.js';
import { ObsidianAdapter } from '../adapters/ObsidianAdapter.js';
import { createAggregator } from '../core/aggregator.js';
import { createHistoryStore } from '../core/historyStore.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const VAULT_FIXTURE = path.join(__dirname, 'fixtures', 'vault-tree');
const BOARD_FIXTURE = path.join(__dirname, 'fixtures', 'sample-board.md');

async function buildAppWithSetup({ initialAdapters = [], sourcesOnDisk = [] } = {}) {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'qd-setup-'));
  if (sourcesOnDisk.length > 0) {
    await fs.mkdir(path.join(tmpDir, 'config'), { recursive: true });
    await fs.writeFile(
      path.join(tmpDir, 'config', 'sources.json'),
      JSON.stringify({ sources: sourcesOnDisk })
    );
  }
  const history = createHistoryStore(path.join(tmpDir, 'data', 'history.jsonl'));
  const aggregator = createAggregator(initialAdapters, history);
  const ADAPTER_REGISTRY = { ObsidianAdapter };
  const app = express();
  app.use(express.json());
  app.use('/api/setup', createSetupRoute({ rootDir: tmpDir, aggregator, adapterRegistry: ADAPTER_REGISTRY }));
  return { app, tmpDir, aggregator, history };
}

describe('GET /api/setup/browse', () => {
  test('files mode lists subdirs + .md files with isKanban annotation', async () => {
    const { app, tmpDir } = await buildAppWithSetup();
    try {
      const tasksDir = path.join(VAULT_FIXTURE, 'Tasks');
      const res = await request(app).get(`/api/setup/browse?path=${encodeURIComponent(tasksDir)}&mode=files`);
      expect(res.status).toBe(200);
      expect(res.body.resolvedPath).toBe(tasksDir);
      const files = res.body.entries.filter(e => e.kind === 'file');
      expect(files.map(f => f.name).sort()).toEqual(['board.md', 'other-board.md']);
      expect(files.every(f => f.isKanban === true)).toBe(true);
    } finally {
      await fs.rm(tmpDir, { recursive: true, force: true });
    }
  });

  test('folders mode lists subdirs only with hasObsidianMarker annotation', async () => {
    const { app, tmpDir } = await buildAppWithSetup();
    try {
      const parentDir = path.dirname(VAULT_FIXTURE);
      const res = await request(app).get(`/api/setup/browse?path=${encodeURIComponent(parentDir)}&mode=folders`);
      expect(res.status).toBe(200);
      const vaultEntry = res.body.entries.find(e => e.name === 'vault-tree');
      expect(vaultEntry).toBeDefined();
      expect(vaultEntry.kind).toBe('directory');
      expect(vaultEntry.hasObsidianMarker).toBe(true);
      const fileEntries = res.body.entries.filter(e => e.kind === 'file');
      expect(fileEntries).toHaveLength(0);
    } finally {
      await fs.rm(tmpDir, { recursive: true, force: true });
    }
  });

  test('returns 403 for path outside HOME', async () => {
    const { app, tmpDir } = await buildAppWithSetup();
    try {
      const res = await request(app).get('/api/setup/browse?path=%2Fetc&mode=files');
      expect(res.status).toBe(403);
      expect(res.body.error).toBe('path_out_of_bounds');
    } finally {
      await fs.rm(tmpDir, { recursive: true, force: true });
    }
  });

  test('defaults to home directory when path omitted', async () => {
    const { app, tmpDir } = await buildAppWithSetup();
    try {
      const res = await request(app).get('/api/setup/browse?mode=files');
      expect(res.status).toBe(200);
      expect(res.body.resolvedPath).toBe(await fs.realpath(os.homedir()));
    } finally {
      await fs.rm(tmpDir, { recursive: true, force: true });
    }
  });

  test('returns 400 for invalid mode', async () => {
    const { app, tmpDir } = await buildAppWithSetup();
    try {
      const res = await request(app).get('/api/setup/browse?mode=bogus');
      expect(res.status).toBe(400);
    } finally {
      await fs.rm(tmpDir, { recursive: true, force: true });
    }
  });
});

describe('GET /api/setup/status', () => {
  test('returns setupNeeded: true when no sources configured', async () => {
    const { app, tmpDir } = await buildAppWithSetup();
    try {
      const res = await request(app).get('/api/setup/status');
      expect(res.status).toBe(200);
      expect(res.body.setupNeeded).toBe(true);
      expect(res.body.sources).toEqual([]);
    } finally {
      await fs.rm(tmpDir, { recursive: true, force: true });
    }
  });

  test('returns setupNeeded: false + sources list when sources configured', async () => {
    const sourcesOnDisk = [
      { id: 'obsidian', adapter: 'ObsidianAdapter', config: { file: BOARD_FIXTURE, vault: 'TestVault' }, pollIntervalSec: 60 },
    ];
    const { app, tmpDir } = await buildAppWithSetup({ sourcesOnDisk });
    try {
      const res = await request(app).get('/api/setup/status');
      expect(res.status).toBe(200);
      expect(res.body.setupNeeded).toBe(false);
      expect(res.body.sources).toHaveLength(1);
      expect(res.body.sources[0].file).toBe(BOARD_FIXTURE);
      expect(res.body.sources[0].vault).toBe('TestVault');
    } finally {
      await fs.rm(tmpDir, { recursive: true, force: true });
    }
  });
});

describe('POST /api/setup/scan-vault', () => {
  test('returns kanban-marker files + auto-detected vault name', async () => {
    const { app, tmpDir } = await buildAppWithSetup();
    try {
      const res = await request(app).post('/api/setup/scan-vault').send({ path: VAULT_FIXTURE });
      expect(res.status).toBe(200);
      expect(res.body.vaultName).toBe('vault-tree');
      const paths = res.body.boards.map(b => b.relativePath).sort();
      expect(paths).toEqual(['Tasks/board.md', 'Tasks/other-board.md']);
    } finally {
      await fs.rm(tmpDir, { recursive: true, force: true });
    }
  });

  test('returns 403 for path outside HOME', async () => {
    const { app, tmpDir } = await buildAppWithSetup();
    try {
      const res = await request(app).post('/api/setup/scan-vault').send({ path: '/etc' });
      expect(res.status).toBe(403);
    } finally {
      await fs.rm(tmpDir, { recursive: true, force: true });
    }
  });

  test('returns 400 for missing path body', async () => {
    const { app, tmpDir } = await buildAppWithSetup();
    try {
      const res = await request(app).post('/api/setup/scan-vault').send({});
      expect(res.status).toBe(400);
    } finally {
      await fs.rm(tmpDir, { recursive: true, force: true });
    }
  });
});
