export function ProgressBar({ label, current, target, ambitionTarget, size = 'lg' }) {
  const pct = target > 0 ? Math.min(100, Math.round((current / target) * 100)) : 0;
  const ambitionPct = ambitionTarget ? Math.min(100, Math.round((ambitionTarget / target) * 100)) : null;
  const heights = { lg: 'h-4', sm: 'h-2' };

  return (
    <div className="w-full">
      <div className="flex justify-between text-xs uppercase opacity-90">
        <span className="tracking-widest">{label}</span>
        <span>{current} / {target} XP</span>
      </div>
      <div className={`${heights[size]} relative bg-hud-border mt-1 border border-hud-border overflow-hidden`}>
        <div
          data-testid="progress-fill"
          className="h-full bg-hud-accent transition-[width] duration-700 ease-out"
          style={{ width: `${pct}%` }}
        />
        {ambitionPct !== null && (
          <div
            data-testid="ambition-marker"
            className="absolute top-0 bottom-0 w-px bg-hud-xp opacity-70"
            style={{ left: `${ambitionPct}%` }}
          />
        )}
      </div>
    </div>
  );
}
