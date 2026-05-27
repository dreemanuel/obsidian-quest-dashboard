export function BrowserRow({ entry, onNavigate, onToggle, selectable = false, selected = false }) {
  const isDir = entry.kind === 'directory';
  const isKanban = entry.kind === 'file' && entry.isKanban === true;
  const clickable = isDir || (selectable && isKanban);

  const handleClick = () => {
    if (!clickable) return;
    if (isDir) onNavigate(entry.fullPath);
    else onToggle(entry.fullPath);
  };

  const icon = isDir ? '▸' : ' ';
  const badge = isDir && entry.hasObsidianMarker
    ? <span className="ml-2 text-[10px] uppercase tracking-widest opacity-70">(vault)</span>
    : isKanban
      ? <span className="ml-2 text-[10px] uppercase tracking-widest text-hud-success">[kanban]</span>
      : null;

  const opacityClass = clickable ? '' : 'opacity-30';
  const selectedClass = selected ? 'bg-hud-accent/20 border-hud-accent' : 'border-transparent';

  return (
    <div
      className={`flex items-center gap-2 px-3 py-2 border ${selectedClass} ${opacityClass} ${clickable ? 'cursor-pointer hover:bg-hud-surface' : 'cursor-default'}`}
      onClick={handleClick}
    >
      <span aria-hidden>{selectable && isKanban ? (selected ? '☑' : '☐') : icon}</span>
      <span className="text-sm">{entry.name}</span>
      {badge}
    </div>
  );
}
