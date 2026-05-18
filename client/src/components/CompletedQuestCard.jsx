export function CompletedQuestCard({ quest }) {
  const dateStr = quest.completedAt ? quest.completedAt.slice(0, 10) : '';
  return (
    <div className="p-3 border border-hud-border opacity-30 select-none">
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-sm leading-snug line-through text-hud-accent">{quest.title}</h3>
        <span className="text-hud-success" aria-label="completed">✓</span>
      </div>
      {dateStr && <p className="text-[10px] mt-1 opacity-70">{dateStr}</p>}
    </div>
  );
}
