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

describe('computeXp — modifiers stack additively', () => {
  test('🔥 adds +10', () => {
    expect(computeXp({ title: '🔥 Foo', rawLane: 'DEV - PERSONAL' }).xp).toBe(25);
  });
  test('⭐ adds +5', () => {
    expect(computeXp({ title: '⭐ Foo', rawLane: 'DEV - PERSONAL' }).xp).toBe(20);
  });
  test('🔺 adds +10', () => {
    expect(computeXp({ title: '🔺 Foo', rawLane: 'DEV - PERSONAL' }).xp).toBe(25);
  });
  test('URGENT adds +5', () => {
    expect(computeXp({ title: 'URGENT Foo', rawLane: 'DEV - PERSONAL' }).xp).toBe(20);
  });
  test('TODAY adds +5', () => {
    expect(computeXp({ title: 'TODAY Foo', rawLane: 'DEV - PERSONAL' }).xp).toBe(20);
  });
  test('multiple modifiers stack', () => {
    // base 25 (JOB SEARCH) + 10 (🔥) + 5 (⭐) + 5 (URGENT) = 45
    const { xp } = computeXp({
      title: '🔥 ⭐ URGENT Apply to Vercel',
      rawLane: '🚀 JOB SEARCH - SAAS COMPANIES',
    });
    expect(xp).toBe(45);
  });
});

describe('computeXp — #xpN override', () => {
  test('#xp25 overrides auto rules', () => {
    const { xp, xpSource } = computeXp({
      title: 'Foo #xp25',
      rawLane: 'TO DO - BACKBURNER',
    });
    expect(xp).toBe(25);
    expect(xpSource).toBe('tag');
  });
  test('#xp tag prevents modifier stacking', () => {
    const { xp } = computeXp({
      title: '🔥 ⭐ Foo #xp10',
      rawLane: '🚀 JOB SEARCH',
    });
    expect(xp).toBe(10);
  });
  test('xp can be 0', () => {
    expect(computeXp({ title: 'Ignore #xp0', rawLane: 'X' }).xp).toBe(0);
  });
});

describe('deriveFlags', () => {
  test('extracts all flags', () => {
    expect(deriveFlags('🔥 ⭐ 🔺 Foo')).toEqual(['urgent', 'starred', 'critical']);
  });
  test('returns empty array for plain title', () => {
    expect(deriveFlags('plain text')).toEqual([]);
  });
});

describe('stripXpTag', () => {
  test('removes #xpN tag from title', () => {
    expect(stripXpTag('Apply to Vercel #xp25')).toBe('Apply to Vercel');
  });
  test('returns title unchanged when no tag', () => {
    expect(stripXpTag('Apply to Vercel')).toBe('Apply to Vercel');
  });
  test('collapses extra whitespace from removal', () => {
    expect(stripXpTag('Apply #xp25 to Vercel')).toBe('Apply to Vercel');
  });
});
