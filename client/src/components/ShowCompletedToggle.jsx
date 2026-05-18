export function ShowCompletedToggle({ show, onToggle }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={`px-2 py-1 text-xs uppercase tracking-widest border transition-colors ${
        show ? 'border-hud-success text-hud-success' : 'border-hud-border text-hud-border'
      }`}
      aria-pressed={show}
    >
      {show ? '☑ Show Completed' : '☐ Show Completed'}
    </button>
  );
}
