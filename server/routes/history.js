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

      // v1.3 activity tracker: 26 weeks = 182 days ending the upcoming Saturday.
      const daysUntilSat = (6 - now.getDay() + 7) % 7;
      const upcomingSat = new Date(startOfToday.getTime() + daysUntilSat * ONE_DAY_MS);
      const upcomingSatEnd = new Date(upcomingSat.getTime() + ONE_DAY_MS - 1);
      const windowStart = new Date(upcomingSat.getTime() - 181 * ONE_DAY_MS);
      const dailyXpMap = await history.dailyXpByDate(windowStart, upcomingSatEnd);
      const dailyActivity = [];
      for (let i = 0; i < 182; i++) {
        const d = new Date(windowStart.getTime() + i * ONE_DAY_MS);
        const isoDay = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        dailyActivity.push({ date: isoDay, xp: dailyXpMap.get(isoDay) || 0 });
      }

      res.json({
        today: { xp: todayXp, target: targets.daily },
        week: { xp: weekXp, target: targets.weekly },
        rollingAvg7Day: { daily: Math.round(rollingDaily), weekly: Math.round(rollingWeekly) },
        streak,
        totalDays,
        useRollingAvg: totalDays >= 7,
        dailyActivity,
      });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
