export function ModePicker({ onPickFiles, onPickVault }) {
  return (
    <div className="flex flex-col gap-4 max-w-2xl mx-auto">
      <h2 className="text-lg uppercase tracking-widest text-hud-accent glow text-center mb-4">
        ◆ Add Kanban Sources
      </h2>
      <p className="text-center opacity-70 text-sm mb-4">
        Choose how to find your kanban boards:
      </p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <button
          type="button"
          onClick={onPickFiles}
          className="p-6 border border-hud-border hover:border-hud-accent bg-hud-surface text-left"
        >
          <p className="text-sm font-bold text-hud-accent uppercase tracking-widest mb-2">Pick specific file(s)</p>
          <p className="text-xs opacity-70">Navigate to one or more kanban .md files and pick them individually.</p>
        </button>
        <button
          type="button"
          onClick={onPickVault}
          className="p-6 border border-hud-border hover:border-hud-accent bg-hud-surface text-left"
        >
          <p className="text-sm font-bold text-hud-accent uppercase tracking-widest mb-2">Scan a vault folder</p>
          <p className="text-xs opacity-70">Point at an Obsidian vault and we'll auto-detect every kanban board inside it.</p>
        </button>
      </div>
    </div>
  );
}
