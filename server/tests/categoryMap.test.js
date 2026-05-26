import { describe, test, expect } from 'vitest';
import { mapCategory, DEFAULT_RULES, applyRules } from '../core/categoryMap.js';

describe('mapCategory — default rules', () => {
  const cases = [
    { lane: 'TO DO - TODAY !', expected: { category: 'Daily Quests', featured: true, hidden: false } },
    { lane: '🔥 JOB SEARCH - THIS WEEK', expected: { category: 'Job Hunt', featured: false, hidden: false } },
    { lane: '📬 JOB SEARCH - COMPETITORS', expected: { category: 'Job Hunt', featured: false, hidden: false } },
    { lane: 'DEV - PERSONAL', expected: { category: 'Personal Dev', featured: false, hidden: false } },
    { lane: 'DEV - CLIENT-B', expected: { category: 'CLIENT-B', featured: false, hidden: false } },
    { lane: 'DEV - CLIENT-A 🔺', expected: { category: 'CLIENT-A', featured: false, hidden: false } },
    { lane: 'TO DO - BACKBURNER', expected: { category: 'Side Quests', featured: false, hidden: false } },
    { lane: 'DONE - REVIEW', expected: { hidden: true } },
    { lane: 'Archive', expected: { hidden: true } },
    { lane: 'Custom Lane Name', expected: { category: 'Custom Lane Name', featured: false, hidden: false } },
  ];
  for (const { lane, expected } of cases) {
    test(`"${lane}" → ${JSON.stringify(expected)}`, () => {
      const result = mapCategory(lane);
      if (expected.hidden) {
        expect(result.hidden).toBe(true);
      } else {
        expect(result).toMatchObject(expected);
      }
    });
  }
});
