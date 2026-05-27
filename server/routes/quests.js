import { Router } from 'express';

export function createQuestsRoute({ aggregator }) {
  const router = Router();

  router.get('/', async (req, res, next) => {
    try {
      const result = await aggregator.collectAll();
      const setupNeeded = result.meta.sources.length === 0;
      res.json({
        ...result,
        meta: { ...result.meta, setupNeeded },
      });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
