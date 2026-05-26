import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { loadConfig } from './core/configLoader.js';
import { ObsidianAdapter } from './adapters/ObsidianAdapter.js';
import { createAggregator } from './core/aggregator.js';
import { createHistoryStore } from './core/historyStore.js';
import { createQuestsRoute } from './routes/quests.js';
import { createActionsRoute } from './routes/actions.js';
import { createHistoryRoute } from './routes/history.js';
import { createHealthRoute } from './routes/health.js';
import { backfillIfNeeded } from './core/backfill.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '..');
const PORT = process.env.PORT || 3274;

const ADAPTER_REGISTRY = {
  ObsidianAdapter,
};

async function main() {
  const { sources, targets } = await loadConfig(PROJECT_ROOT);

  const adapters = sources.sources.map((s) => {
    const Cls = ADAPTER_REGISTRY[s.adapter];
    if (!Cls) throw new Error(`Unknown adapter: ${s.adapter}`);
    return new Cls(s.config);
  });
  const adaptersById = Object.fromEntries(adapters.map(a => [a.getId(), a]));

  const historyPath = path.join(PROJECT_ROOT, 'data', 'xp-history.jsonl');
  const history = createHistoryStore(historyPath);
  const aggregator = createAggregator(adapters, history);

  const dataDir = path.join(PROJECT_ROOT, 'data');
  for (const adapter of adapters) {
    await backfillIfNeeded(adapter, history, dataDir);
  }

  const app = express();
  app.use(express.json());

  app.use('/api/quests', createQuestsRoute({ aggregator }));
  app.use('/api/quests', createActionsRoute({ aggregator, adaptersById, history }));
  app.use('/api/history', createHistoryRoute({ history, targets }));
  app.use('/api/health', createHealthRoute({ adapters }));

  const distPath = path.join(PROJECT_ROOT, 'client', 'dist');
  app.use(express.static(distPath));

  app.use((err, req, res, _next) => {
    console.error('Server error:', err);
    res.status(500).json({ error: 'internal', message: err.message });
  });

  app.listen(PORT, '127.0.0.1', () => {
    console.log(`Quest Dashboard API listening on http://localhost:${PORT}`);
    console.log(`Loaded ${adapters.length} adapter(s): ${adapters.map(a => a.getId()).join(', ')}`);
  });
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
