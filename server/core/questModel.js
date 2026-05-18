export function createQuest(input) {
  return {
    id: input.id,
    sourceId: input.sourceId,
    sourceRef: input.sourceRef ?? {},
    title: input.title,
    rawTitle: input.rawTitle ?? input.title,
    category: input.category ?? input.rawLane,
    rawLane: input.rawLane,
    xp: input.xp ?? 0,
    xpSource: input.xpSource ?? 'auto',
    flags: input.flags ?? [],
    completed: input.completed ?? false,
    completedAt: input.completedAt ?? null,
    objectives: input.objectives ?? [],
    objectiveProgress: input.objectiveProgress ?? { done: 0, total: 0 },
    deepLink: input.deepLink ?? '',
    notes: input.notes ?? null,
  };
}

export function isCompleted(quest) {
  return quest.completed === true;
}

export function hasObjectives(quest) {
  return Array.isArray(quest.objectives) && quest.objectives.length > 0;
}

export function computeObjectiveProgress(quest) {
  if (!hasObjectives(quest)) return { done: 0, total: 0 };
  const total = quest.objectives.length;
  const done = quest.objectives.filter(isCompleted).length;
  return { done, total };
}
