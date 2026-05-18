import { describe, test, expect } from 'vitest';
import {
  createQuest,
  isCompleted,
  hasObjectives,
  computeObjectiveProgress,
} from '../core/questModel.js';

describe('createQuest', () => {
  test('returns a quest with required defaults', () => {
    const q = createQuest({
      id: 'obs:foo:bar:0',
      sourceId: 'obsidian',
      sourceRef: { file: '/foo.md', line: 5 },
      title: 'Hello',
      rawLane: 'Test Lane',
    });
    expect(q.id).toBe('obs:foo:bar:0');
    expect(q.title).toBe('Hello');
    expect(q.completed).toBe(false);
    expect(q.completedAt).toBeNull();
    expect(q.objectives).toEqual([]);
    expect(q.objectiveProgress).toEqual({ done: 0, total: 0 });
    expect(q.flags).toEqual([]);
    expect(q.xp).toBe(0);
    expect(q.xpSource).toBe('auto');
  });
});

describe('isCompleted', () => {
  test('returns true when completed flag set', () => {
    const q = createQuest({ id: 'x', sourceId: 'o', sourceRef: {}, title: 't', rawLane: 'L', completed: true });
    expect(isCompleted(q)).toBe(true);
  });
  test('returns false when not completed', () => {
    const q = createQuest({ id: 'x', sourceId: 'o', sourceRef: {}, title: 't', rawLane: 'L' });
    expect(isCompleted(q)).toBe(false);
  });
});

describe('hasObjectives', () => {
  test('returns false for empty objectives', () => {
    const q = createQuest({ id: 'x', sourceId: 'o', sourceRef: {}, title: 't', rawLane: 'L' });
    expect(hasObjectives(q)).toBe(false);
  });
  test('returns true when objectives present', () => {
    const child = createQuest({ id: 'y', sourceId: 'o', sourceRef: {}, title: 'c', rawLane: 'L' });
    const q = createQuest({ id: 'x', sourceId: 'o', sourceRef: {}, title: 't', rawLane: 'L', objectives: [child] });
    expect(hasObjectives(q)).toBe(true);
  });
});

describe('computeObjectiveProgress', () => {
  test('zero objectives → 0/0', () => {
    const q = createQuest({ id: 'x', sourceId: 'o', sourceRef: {}, title: 't', rawLane: 'L' });
    expect(computeObjectiveProgress(q)).toEqual({ done: 0, total: 0 });
  });
  test('counts completed children only', () => {
    const c1 = createQuest({ id: 'a', sourceId: 'o', sourceRef: {}, title: 'a', rawLane: 'L', completed: true });
    const c2 = createQuest({ id: 'b', sourceId: 'o', sourceRef: {}, title: 'b', rawLane: 'L', completed: false });
    const c3 = createQuest({ id: 'c', sourceId: 'o', sourceRef: {}, title: 'c', rawLane: 'L', completed: true });
    const q = createQuest({ id: 'x', sourceId: 'o', sourceRef: {}, title: 't', rawLane: 'L', objectives: [c1, c2, c3] });
    expect(computeObjectiveProgress(q)).toEqual({ done: 2, total: 3 });
  });
});
