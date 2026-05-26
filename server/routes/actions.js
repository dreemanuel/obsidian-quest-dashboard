import { Router } from 'express';
import { ConflictError } from '../adapters/SyncAdapter.js';

export function createActionsRoute({ aggregator, adaptersById, history }) {
  const router = Router();

  router.post('/:id/complete', async (req, res, next) => {
    try {
      const { quests } = await aggregator.collectAll();
      const { quest, parent } = findQuestById(quests, req.params.id);
      if (!quest) {
        return res.status(404).json({ error: 'not_found' });
      }
      if (quest.completed) {
        return res.json({ success: true, quest, xpAwarded: 0, parentCompleted: false });
      }

      // Parent-with-incomplete-subtasks → 422
      const isTopLevel = !parent;
      if (isTopLevel && quest.objectives && quest.objectives.length > 0) {
        const remaining = quest.objectives.filter(o => !o.completed).length;
        if (remaining > 0) {
          return res.status(422).json({ error: 'subtasks_incomplete', remaining });
        }
      }

      const adapter = adaptersById[quest.sourceId];
      if (!adapter) {
        return res.status(500).json({ error: 'adapter_missing' });
      }

      let markResult;
      try {
        markResult = await adapter.markComplete(quest.sourceRef);
      } catch (err) {
        if (err instanceof ConflictError || err.code === 'CONFLICT') {
          return res.status(409).json({ error: 'quest_changed', message: err.message });
        }
        throw err;
      }

      const isSubtask = !!parent;
      const nowIso = new Date().toISOString();

      if (!isSubtask) {
        // Top-level completion: award this quest's XP
        await history.appendEvent({
          ts: nowIso,
          questId: quest.id,
          xp: quest.xp,
          source: quest.sourceId,
          title: quest.title,
        });
        const updatedQuest = { ...quest, completed: true, completedAt: nowIso };
        return res.json({ success: true, quest: updatedQuest, xpAwarded: quest.xp, parentCompleted: false });
      }

      // Subtask completion
      let xpAwarded = 0;
      let parentCompleted = false;
      let updatedParent;
      if (markResult.parentCompleted) {
        await history.appendEvent({
          ts: nowIso,
          questId: parent.id,
          xp: parent.xp,
          source: parent.sourceId,
          title: parent.title,
        });
        xpAwarded = parent.xp;
        parentCompleted = true;
        updatedParent = { ...parent, completed: true, completedAt: nowIso };
      }

      const updatedSubtask = { ...quest, completed: true };
      return res.json({
        success: true,
        subtask: updatedSubtask,
        xpAwarded,
        parentCompleted,
        parent: updatedParent,
      });
    } catch (err) {
      next(err);
    }
  });

  return router;
}

/**
 * Find a quest by id. If it's a subtask (nested in some quest's objectives),
 * also return the parent quest.
 */
function findQuestById(quests, id) {
  for (const q of quests) {
    if (q.id === id) return { quest: q, parent: null };
    if (q.objectives) {
      for (const o of q.objectives) {
        if (o.id === id) return { quest: o, parent: q };
      }
    }
  }
  return { quest: null, parent: null };
}
