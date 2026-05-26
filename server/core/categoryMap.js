export const DEFAULT_RULES = [
  { test: (lane) => lane === 'TO DO - TODAY !', map: () => ({ category: 'Daily Quests', featured: true }) },
  { test: (lane) => /JOB SEARCH/i.test(lane), map: () => ({ category: 'Job Hunt' }) },
  { test: (lane) => /^DEV - (.+)/.test(lane), map: (lane) => {
      const suffix = lane.match(/^DEV - (.+)/)[1].replace(/🔺/g, '').trim();
      // Default: PERSONAL → 'Personal Dev'; any other suffix becomes the
      // category name as-is (e.g., `DEV - MYAPP` → category `MYAPP`).
      // Override via config/categoryMap.json for friendlier names.
      const name = suffix === 'PERSONAL' ? 'Personal Dev' : suffix;
      return { category: name };
    }
  },
  { test: (lane) => lane === 'TO DO - BACKBURNER', map: () => ({ category: 'Side Quests' }) },
  { test: (lane) => lane === 'DONE - REVIEW' || lane === 'Archive', map: () => ({ hidden: true }) },
];

export function applyRules(lane, rules = DEFAULT_RULES) {
  for (const rule of rules) {
    if (rule.test(lane)) {
      const result = rule.map(lane);
      return {
        category: result.category ?? lane,
        featured: result.featured ?? false,
        hidden: result.hidden ?? false,
      };
    }
  }
  return { category: lane, featured: false, hidden: false };
}

export function mapCategory(lane) {
  return applyRules(lane);
}
