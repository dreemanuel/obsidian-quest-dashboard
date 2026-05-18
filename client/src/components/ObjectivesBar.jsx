export function ObjectivesBar({ done, total }) {
  if (total === 0) return null;
  const pct = Math.round((done / total) * 100);
  return (
    <div className="w-full mt-2">
      <div className="flex justify-between text-[10px] uppercase opacity-70">
        <span>Objectives</span>
        <span>{done}/{total}</span>
      </div>
      <div className="h-1 bg-hud-border mt-1 overflow-hidden">
        <div
          data-testid="objectives-fill"
          className="h-full bg-hud-accent"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
