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
import { createActionsRoute } from '../routes/actions.js';
import { createHistoryRoute } from '../routes/history.js';
import { createHealthRoute } from '../routes/health.js';

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

async function buildAppWithActions() {
  const built = await buildApp();
  built.app.use(express.json());
  built.app.use('/api/quests', createActionsRoute({ aggregator: built.aggregator, adaptersById: { obsidian: built.adapter }, history: built.history }));
  return built;
}

describe('POST /api/quests/:id/complete', () => {
  test('marks quest complete and returns success', async () => {
    const { app, tmpDir, aggregator } = await buildAppWithActions();
    try {
      const { quests } = await aggregator.collectAll();
      const target = quests[0];
      const res = await request(app).post(`/api/quests/${encodeURIComponent(target.id)}/complete`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.xpAwarded).toBe(target.xp);
    } finally {
      await fs.rm(tmpDir, { recursive: true, force: true });
    }
  });

  test('returns 404 for unknown quest id', async () => {
    const { app, tmpDir } = await buildAppWithActions();
    try {
      const res = await request(app).post('/api/quests/nonexistent/complete');
      expect(res.status).toBe(404);
      expect(res.body.error).toBe('not_found');
    } finally {
      await fs.rm(tmpDir, { recursive: true, force: true });
    }
  });
});

describe('GET /api/history', () => {
  test('returns today/week sums + streak', async () => {
    const built = await buildApp();
    built.app.use('/api/history', createHistoryRoute({ history: built.history, targets: { daily: 50, weekly: 250 } }));
    try {
      const res = await request(built.app).get('/api/history');
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('today.xp');
      expect(res.body).toHaveProperty('week.xp');
      expect(res.body).toHaveProperty('streak');
      expect(res.body).toHaveProperty('rollingAvg7Day');
    } finally {
      await fs.rm(built.tmpDir, { recursive: true, force: true });
    }
  });
});

describe('GET /api/health', () => {
  test('returns ok status when source healthy', async () => {
    const built = await buildApp();
    built.app.use('/api/health', createHealthRoute({ adapters: [built.adapter] }));
    try {
      const res = await request(built.app).get('/api/health');
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('ok');
      expect(res.body.sources[0].id).toBe('obsidian');
    } finally {
      await fs.rm(built.tmpDir, { recursive: true, force: true });
    }
  });
});
