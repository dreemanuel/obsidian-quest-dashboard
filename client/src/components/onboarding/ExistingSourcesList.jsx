export function ExistingSourcesList({ sources, onRemove }) {
  if (!sources || sources.length === 0) return null;
  return (
    <section className="max-w-2xl mx-auto mb-8 p-4 border border-hud-border bg-hud-surface">
      <h3 className="text-xs uppercase tracking-widest opacity-70 mb-3">Currently configured sources</h3>
      <ul className="space-y-2">
        {sources.map(src => (
          <li key={src.file} className="flex items-center justify-between gap-2">
            <div className="text-sm">
              <p className="text-hud-accent truncate">{src.file}</p>
              <p className="text-[10px] uppercase tracking-widest opacity-60">vault: {src.vault}</p>
            </div>
            <button
              type="button"
              onClick={() => onRemove(src.file)}
              aria-label={`Remove ${src.file}`}
              className="px-2 py-1 text-xs border border-hud-warn text-hud-warn hover:bg-hud-warn/10"
            >
              ✕
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
