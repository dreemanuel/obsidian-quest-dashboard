import { computeXp, deriveFlags, stripXpTag } from './scoring.js';
import { applyRules as mapCategory } from './categoryMap.js';

export function createAggregator(adapters, historyStore) {
  let previousSnapshot = null;

  async function collectAll() {
    const sourceResults = await Promise.allSettled(
      adapters.map(a => a.listQuests())
    );

    const allQuests = [];
    const sourceMeta = [];

    for (let i = 0; i < adapters.length; i++) {
      const adapter = adapters[i];
      const result = sourceResults[i];
      if (result.status === 'fulfilled') {
        const enriched = result.value.map(q => enrichQuest(q));
        const visible = enriched.filter(q => q.__visible);
        allQuests.push(...visible);
        sourceMeta.push({ id: adapter.getId(), status: 'ok', questCount: visible.length });
      } else {
        sourceMeta.push({ id: adapter.getId(), status: 'error', error: result.reason.message });
      }
    }

    // Detect new completions
    if (previousSnapshot) {
      const newCompletions = detectCompletions(previousSnapshot, allQuests);
      const deduped = [];
      for (const event of newCompletions) {
        if (!(await historyStore.isDuplicate(event.questId, new Date(event.ts)))) {
          deduped.push(event);
        }
      }
      if (deduped.length > 0) await historyStore.appendBatch(deduped);
    }
    previousSnapshot = allQuests.map(snapshotShape);

    return {
      quests: sortQuests(allQuests),
      categories: orderedCategories(allQuests),
      meta: {
        lastSyncAt: new Date().toISOString(),
        sources: sourceMeta,
      },
    };
  }

  return { collectAll };
}

const CATEGORY_ORDER = ['Daily Quests', 'Job Hunt', 'Personal Dev', 'Codaic', 'Venera', 'Side Quests'];

function enrichQuest(q) {
  const mapping = mapCategory(q.rawLane);
  if (mapping.hidden) return { ...q, __visible: false };
  const { xp, xpSource } = computeXp({ title: q.title, rawLane: q.rawLane });
  const cleanTitle = stripXpTag(q.title);
  const flags = deriveFlags(cleanTitle);
  return {
    ...q,
    title: cleanTitle,
    xp,
    xpSource,
    flags,
    category: mapping.category,
    featured: mapping.featured,
    __visible: true,
  };
}

function snapshotShape(q) {
  return { id: q.id, completed: q.completed, completedAt: q.completedAt, xp: q.xp, title: q.title };
}

function detectCompletions(prev, current) {
  const prevMap = new Map(prev.map(p => [p.id, p]));
  const events = [];
  for (const q of current) {
    const prior = prevMap.get(q.id);
    if (q.completed && prior && !prior.completed) {
      events.push({
        ts: q.completedAt || new Date().toISOString(),
        questId: q.id,
        xp: q.xp,
        source: q.sourceId,
        title: q.title,
      });
    }
  }
  return events;
}

function sortQuests(quests) {
  return [...quests].sort((a, b) => {
    if (a.category !== b.category) {
      return categoryRank(a.category) - categoryRank(b.category);
    }
    if (a.completed !== b.completed) return a.completed ? 1 : -1;
    if (b.xp !== a.xp) return b.xp - a.xp;
    return a.title.localeCompare(b.title);
  });
}

function orderedCategories(quests) {
  const seen = new Set(quests.map(q => q.category));
  const ordered = CATEGORY_ORDER.filter(c => seen.has(c));
  for (const cat of seen) if (!ordered.includes(cat)) ordered.push(cat);
  return ordered;
}

function categoryRank(category) {
  const idx = CATEGORY_ORDER.indexOf(category);
  return idx === -1 ? CATEGORY_ORDER.length : idx;
}
