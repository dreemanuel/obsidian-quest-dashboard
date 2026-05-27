import { useState, useEffect, useCallback } from 'react';
import { browse } from '../../lib/setupApi.js';
import { BrowserRow } from './BrowserRow.jsx';

export function FileBrowser({ onNext, onBack, initialPath }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedByPath, setSelectedByPath] = useState({});

  const load = useCallback(async (path) => {
    setLoading(true);
    setError(null);
    try {
      const result = await browse({ path, mode: 'files' });
      setData(result);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(initialPath); }, [load, initialPath]);

  const navigate = (path) => load(path);
  const toggle = (fullPath) => {
    setSelectedByPath(prev => {
      const next = { ...prev };
      if (next[fullPath]) delete next[fullPath];
      else {
        const entry = data?.entries.find(e => e.fullPath === fullPath);
        next[fullPath] = entry;
      }
      return next;
    });
  };

  const selectedList = Object.values(selectedByPath);
  const selectedCount = selectedList.length;

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-3">
        <p className="text-xs uppercase tracking-widest opacity-70">Current path</p>
        <p className="text-sm font-mono text-hud-accent truncate">{data?.resolvedPath || '...'}</p>
      </div>

      {data?.parent && (
        <BrowserRow entry={{ name: '..', kind: 'directory', fullPath: data.parent }} onNavigate={navigate} />
      )}

      {loading && <p className="opacity-70 text-sm py-4">Loading...</p>}
      {error && <p className="text-hud-warn text-sm py-4">{error.message}</p>}

      {data && !loading && (
        <div className="max-h-96 overflow-y-auto border border-hud-border">
          {data.entries.map(entry => (
            <BrowserRow
              key={entry.fullPath}
              entry={entry}
              onNavigate={navigate}
              onToggle={toggle}
              selectable
              selected={!!selectedByPath[entry.fullPath]}
            />
          ))}
          {data.truncated && (
            <p className="text-xs opacity-70 p-2 text-center">Showing 500 entries — narrow your path to see more.</p>
          )}
        </div>
      )}

      <div className="mt-4 flex items-center justify-between">
        <button type="button" onClick={onBack} className="px-3 py-2 border border-hud-border text-hud-accent text-xs uppercase tracking-widest">
          Back
        </button>
        <p className="text-xs opacity-70">{selectedCount} file{selectedCount === 1 ? '' : 's'} selected</p>
        <button
          type="button"
          onClick={() => onNext(selectedList.map(e => ({ fullPath: e.fullPath, name: e.name, inferredVault: e.inferredVault ?? null })))}
          disabled={selectedCount === 0}
          className={`px-3 py-2 text-xs uppercase tracking-widest ${selectedCount === 0 ? 'border border-hud-border opacity-40 cursor-not-allowed' : 'bg-hud-accent text-hud-bg font-bold'}`}
        >
          Next →
        </button>
      </div>
    </div>
  );
}
