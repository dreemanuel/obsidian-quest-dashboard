import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';
import express from 'express';
import request from 'supertest';
import { ObsidianAdapter } from '../adapters/ObsidianAdapter.js';
import { createAggregator } from '../core/aggregator.js';
import { createHistoryStore } from '../core/historyStore.js';
import { createQuestsRoute } from '../routes/quests.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const FIXTURE = path.join(__dirname, 'fixtures', 'sample-board.md');

async function buildApp() {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'qd-routes-'));
  const workingFile = path.join(tmpDir, 'board.md');
  const historyFile = path.join(tmpDir, 'history.jsonl');
  await fs.writeFile(workingFile, await fs.readFile(FIXTURE, 'utf8'));

  const adapter = new ObsidianAdapter({ file: workingFile, vault: 'V' });
  const history = createHistoryStore(historyFile);
  const aggregator = createAggregator([adapter], history);

  const app = express();
  app.use('/api/quests', createQuestsRoute({ aggregator }));

  return { app, tmpDir, adapter, history, aggregator };
}

describe('GET /api/quests', () => {
  test('returns 200 with quest list', async () => {
    const { app, tmpDir } = await buildApp();
    try {
      const res = await request(app).get('/api/quests');
      expect(res.status).toBe(200);
      expect(res.body.quests).toBeInstanceOf(Array);
      expect(res.body.quests.length).toBeGreaterThan(0);
      expect(res.body.categories).toBeInstanceOf(Array);
      expect(res.body.meta.sources[0].id).toBe('obsidian');
    } finally {
      await fs.rm(tmpDir, { recursive: true, force: true });
    }
  });
});
