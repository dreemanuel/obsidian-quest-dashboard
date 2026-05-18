import { Router } from 'express';

export function createHealthRoute({ adapters }) {
  const router = Router();

  router.get('/', async (req, res, next) => {
    try {
      const results = await Promise.all(adapters.map(async (a) => {
        const h = await a.healthCheck();
        return {
          id: a.getId(),
          status: h.status,
          lastError: h.lastError ?? null,
          lastSuccess: h.status === 'ok' ? new Date().toISOString() : null,
        };
      }));
      const overall = results.every(r => r.status === 'ok') ? 'ok' : 'degraded';
      res.json({ status: overall, sources: results });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
