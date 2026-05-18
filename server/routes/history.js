import { Router } from 'express';

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

export function createHistoryRoute({ history, targets }) {
  const router = Router();

  router.get('/', async (req, res, next) => {
    try {
      const now = new Date();
      const startOfToday = new Date(now);
      startOfToday.setHours(0, 0, 0, 0);
      const endOfToday = new Date(startOfToday.getTime() + ONE_DAY_MS - 1);

      const dayOfWeek = (now.getDay() + 6) % 7; // 0 = Monday
      const startOfWeek = new Date(startOfToday.getTime() - dayOfWeek * ONE_DAY_MS);
      const endOfWeek = new Date(startOfWeek.getTime() + 7 * ONE_DAY_MS - 1);

      const todayXp = await history.sumXpInWindow(startOfToday, endOfToday);
      const weekXp = await history.sumXpInWindow(startOfWeek, endOfWeek);
      const rollingDaily = await history.rollingDailyAverage(endOfToday, 7);
      const rollingWeekly = rollingDaily * 7;
      const streak = await history.streakDays(endOfToday);
      const allEvents = await history.readAll();
      const totalDays = new Set(allEvents.map(e => e.ts.slice(0, 10))).size;

      res.json({
        today: { xp: todayXp, target: targets.daily },
        week: { xp: weekXp, target: targets.weekly },
        rollingAvg7Day: { daily: Math.round(rollingDaily), weekly: Math.round(rollingWeekly) },
        streak,
        totalDays,
        useRollingAvg: totalDays >= 7,
      });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
