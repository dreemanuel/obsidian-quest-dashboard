import { promises as fs } from 'fs';
import path from 'path';

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

export function createHistoryStore(filePath) {
  const api = {
    async appendEvent(event) {
      await fs.mkdir(path.dirname(filePath), { recursive: true });
      const line = JSON.stringify(event) + '\n';
      await fs.appendFile(filePath, line);
    },

    async appendBatch(events) {
      if (events.length === 0) return;
      await fs.mkdir(path.dirname(filePath), { recursive: true });
      const block = events.map(e => JSON.stringify(e)).join('\n') + '\n';
      await fs.appendFile(filePath, block);
    },

    async readAll() {
      try {
        const raw = await fs.readFile(filePath, 'utf8');
        return raw
          .trim()
          .split('\n')
          .filter(l => l.length > 0)
          .map(l => JSON.parse(l));
      } catch (err) {
        if (err.code === 'ENOENT') return [];
        throw err;
      }
    },

    async sumXpInWindow(startDate, endDate) {
      const events = await api.readAll();
      return events
        .filter(e => {
          const ts = new Date(e.ts).getTime();
          return ts >= startDate.getTime() && ts <= endDate.getTime();
        })
        .reduce((sum, e) => sum + (e.xp || 0), 0);
    },

    async rollingDailyAverage(endDate, days = 7) {
      const start = new Date(endDate.getTime() - (days - 1) * ONE_DAY_MS);
      const total = await api.sumXpInWindow(start, endDate);
      return total / days;
    },

    async isDuplicate(questId, ts) {
      const targetDate = isoDate(ts);
      const events = await api.readAll();
      return events.some(e => e.questId === questId && isoDate(new Date(e.ts)) === targetDate);
    },

    async streakDays(endDate) {
      const events = await api.readAll();
      const xpByDate = new Map();
      for (const e of events) {
        const d = isoDate(new Date(e.ts));
        xpByDate.set(d, (xpByDate.get(d) || 0) + (e.xp || 0));
      }
      let streak = 0;
      let cursor = new Date(endDate);
      while (true) {
        const key = isoDate(cursor);
        if ((xpByDate.get(key) || 0) > 0) {
          streak += 1;
          cursor = new Date(cursor.getTime() - ONE_DAY_MS);
        } else {
          break;
        }
      }
      return streak;
    },

    async dailyXpByDate(startDate, endDate) {
      const events = await api.readAll();
      const result = new Map();
      const startMs = startDate.getTime();
      const endMs = endDate.getTime();
      for (const e of events) {
        const ts = new Date(e.ts).getTime();
        if (ts < startMs || ts > endMs) continue;
        const isoDay = isoDate(new Date(e.ts));
        result.set(isoDay, (result.get(isoDay) || 0) + (e.xp || 0));
      }
      return result;
    },
  };
  return api;
}

function isoDate(date) {
  return date.toISOString().slice(0, 10);
}
