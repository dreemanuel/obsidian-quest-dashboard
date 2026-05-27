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
