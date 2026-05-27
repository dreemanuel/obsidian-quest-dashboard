import { useState } from 'react';

export function ChecklistReview({ candidates, onBack, onConfirm }) {
  const [rows, setRows] = useState(() =>
    candidates.map(c => ({
      file: c.fullPath,
      name: c.name,
      vault: c.inferredVault || '',
      checked: true,
    }))
  );

  const checkedCount = rows.filter(r => r.checked).length;

  const toggle = (idx) => setRows(prev =>
    prev.map((r, i) => i === idx ? { ...r, checked: !r.checked } : r)
  );

  const updateVault = (idx, value) => setRows(prev =>
    prev.map((r, i) => i === idx ? { ...r, vault: value } : r)
  );

  const handleConfirm = () => {
    const selected = rows.filter(r => r.checked).map(r => ({
      file: r.file,
      vault: r.vault,
    }));
    onConfirm(selected);
  };

  return (
    <div className="max-w-3xl mx-auto">
      <h2 className="text-lg uppercase tracking-widest text-hud-accent glow text-center mb-4">
        ◆ Review Sources
      </h2>
      <p className="text-center opacity-70 text-sm mb-4">
        Detected {candidates.length} board{candidates.length === 1 ? '' : 's'}. Uncheck any you don't want included.
      </p>

      <div className="border border-hud-border">
        {rows.map((row, idx) => (
          <div key={row.file} className="flex items-center gap-3 px-3 py-2 border-b border-hud-border last:border-b-0">
            <input
              type="checkbox"
              checked={row.checked}
              onChange={() => toggle(idx)}
              aria-label={`Include ${row.name}`}
            />
            <p className="flex-1 text-sm font-mono text-hud-accent truncate">{row.file}</p>
            <label className="flex items-center gap-2">
              <span className="text-[10px] uppercase tracking-widest opacity-70">vault</span>
              <input
                type="text"
                value={row.vault}
                onChange={(e) => updateVault(idx, e.target.value)}
                placeholder="Vault name"
                className="w-32 px-2 py-1 text-xs bg-hud-bg border border-hud-border text-hud-accent"
              />
            </label>
          </div>
        ))}
      </div>

      <div className="mt-4 flex items-center justify-between">
        <button type="button" onClick={onBack} className="px-3 py-2 border border-hud-border text-hud-accent text-xs uppercase tracking-widest">
          Back
        </button>
        <p className="text-xs opacity-70">{checkedCount} of {rows.length} selected</p>
        <button
          type="button"
          onClick={handleConfirm}
          disabled={checkedCount === 0}
          className={`px-3 py-2 text-xs uppercase tracking-widest ${checkedCount === 0 ? 'border border-hud-border opacity-40 cursor-not-allowed' : 'bg-hud-accent text-hud-bg font-bold'}`}
        >
          Confirm + Load Dashboard →
        </button>
      </div>
    </div>
  );
}
