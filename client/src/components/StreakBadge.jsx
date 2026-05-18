export function StreakBadge({ days }) {
  return (
    <span className="text-xs uppercase tracking-widest opacity-80">
      Streak: <span className="text-hud-success font-bold">{days}</span> {days === 1 ? 'day' : 'days'}
    </span>
  );
}
