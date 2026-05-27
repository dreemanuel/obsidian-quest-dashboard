import { Router } from 'express';
import path from 'path';
import { promises as fs } from 'fs';

export function createSetupRoute({ rootDir, aggregator, adapterRegistry }) {
  const router = Router();

  router.get('/status', async (req, res, next) => {
    try {
      const sources = await readSourcesFromDisk(rootDir);
      res.json({
        setupNeeded: sources.length === 0,
        sources: sources.map(s => ({
          id: s.id,
          adapter: s.adapter,
          file: s.config.file,
          vault: s.config.vault,
        })),
      });
    } catch (err) {
      next(err);
    }
  });

  return router;
}

async function readSourcesFromDisk(rootDir) {
  const sourcesPath = path.join(rootDir, 'config', 'sources.json');
  try {
    const raw = await fs.readFile(sourcesPath, 'utf8');
    const parsed = JSON.parse(raw);
    return parsed.sources || [];
  } catch (err) {
    if (err.code === 'ENOENT') return [];
    throw err;
  }
}
