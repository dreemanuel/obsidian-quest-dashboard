import { Router } from 'express';
import { ConflictError } from '../adapters/SyncAdapter.js';

export function createActionsRoute({ aggregator, adaptersById, history }) {
  const router = Router();

  router.post('/:id/complete', async (req, res, next) => {
    try {
      const { quests } = await aggregator.collectAll();
      const quest = quests.find(q => q.id === req.params.id);
      if (!quest) {
        return res.status(404).json({ error: 'not_found' });
      }
      if (quest.completed) {
        return res.json({ success: true, quest, xpAwarded: 0 });
      }
      const adapter = adaptersById[quest.sourceId];
      if (!adapter) {
        return res.status(500).json({ error: 'adapter_missing' });
      }
      try {
        await adapter.markComplete(quest.sourceRef);
      } catch (err) {
        if (err instanceof ConflictError || err.code === 'CONFLICT') {
          return res.status(409).json({ error: 'quest_changed', message: err.message });
        }
        throw err;
      }
      await history.appendEvent({
        ts: new Date().toISOString(),
        questId: quest.id,
        xp: quest.xp,
        source: quest.sourceId,
        title: quest.title,
      });
      const updatedQuest = { ...quest, completed: true, completedAt: new Date().toISOString() };
      res.json({ success: true, quest: updatedQuest, xpAwarded: quest.xp });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
