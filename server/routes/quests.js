import { Router } from 'express';

export function createQuestsRoute({ aggregator }) {
  const router = Router();

  router.get('/', async (req, res, next) => {
    try {
      const result = await aggregator.collectAll();
      res.json(result);
    } catch (err) {
      next(err);
    }
  });

  return router;
}
