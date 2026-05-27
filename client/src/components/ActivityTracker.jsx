function todayIso() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function bucketClass(xp, target, date, todayStr) {
  if (date > todayStr) return 'bg-hud-border/30';
  if (xp === 0) return 'bg-hud-border/30';
  const ratio = target > 0 ? xp / target : 0;
  if (ratio <= 0.25) return 'bg-hud-accent/25';
  if (ratio <= 0.75) return 'bg-hud-accent/50';
  if (ratio <= 1.25) return 'bg-hud-accent/75';
  return 'bg-hud-accent';
}

function tileTitle(date, xp, todayStr) {
  if (date > todayStr) return `${date} — (future)`;
  return `${date} — ${xp} XP`;
}

export function ActivityTracker({ dailyActivity, dailyTarget }) {
  const today = todayIso();
  return (
    <div
      className="grid gap-[2px] w-max mx-auto"
      style={{
        gridAutoFlow: 'column',
        gridTemplateRows: 'repeat(7, 0.6rem)',
        gridAutoColumns: '0.6rem',
      }}
    >
      {dailyActivity.map(({ date, xp }) => (
        <div
          key={date}
          title={tileTitle(date, xp, today)}
          className={`w-[0.6rem] h-[0.6rem] ${bucketClass(xp, dailyTarget, date, today)}`}
        />
      ))}
    </div>
  );
}
