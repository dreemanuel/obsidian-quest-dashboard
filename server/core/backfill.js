import { promises as fs } from 'fs';
import path from 'path';

export async function backfillIfNeeded(adapter, history, markerDir) {
  const markerPath = path.join(markerDir, `.backfilled-${adapter.getId()}`);
  try {
    await fs.access(markerPath);
    return; // already backfilled
  } catch {
    // not yet backfilled — proceed
  }

  const quests = await adapter.listQuests();
  const events = [];
  const collect = (q) => {
    if (q.completed && q.completedAt) {
      events.push({
        ts: q.completedAt,
        questId: q.id,
        xp: q.xp || 0,
        source: q.sourceId,
        title: q.title,
      });
    }
    (q.objectives || []).forEach(collect);
  };
  quests.forEach(collect);

  if (events.length > 0) await history.appendBatch(events);

  await fs.mkdir(markerDir, { recursive: true });
  await fs.writeFile(markerPath, new Date().toISOString());
}
