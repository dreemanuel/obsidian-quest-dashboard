import { describe, test, expect } from 'vitest';
import { computeXp, deriveFlags, stripXpTag } from '../core/scoring.js';

describe('computeXp — base XP by lane', () => {
  const cases = [
    { lane: 'TO DO - TODAY !', title: 'foo', expected: 30 },
    { lane: '🔥 JOB SEARCH - THIS WEEK', title: 'foo', expected: 25 },
    { lane: '📬 JOB SEARCH - SUPPORT ADVENTURE COMPETITORS', title: 'foo', expected: 25 },
    { lane: 'DEV - VENERA 🔺', title: 'foo', expected: 20 },
    { lane: 'DEV - CODAIC', title: 'foo', expected: 20 },
    { lane: 'DEV - PERSONAL', title: 'foo', expected: 15 },
    { lane: 'TO DO - BACKBURNER', title: 'foo', expected: 5 },
    { lane: 'Some Other Lane', title: 'foo', expected: 10 },
  ];
  for (const { lane, title, expected } of cases) {
    test(`"${lane}" → ${expected} XP`, () => {
      const { xp, xpSource } = computeXp({ title, rawLane: lane });
      expect(xp).toBe(expected);
      expect(xpSource).toBe('auto');
    });
  }
});
