import { useState, useEffect, useCallback } from 'react';
import { browse } from '../../lib/setupApi.js';
import { BrowserRow } from './BrowserRow.jsx';

export function FolderBrowser({ onScan, onBack, initialPath }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedPath, setSelectedPath] = useState(null);

  const load = useCallback(async (path) => {
    setLoading(true);
    setError(null);
    setSelectedPath(null);
    try {
      const result = await browse({ path, mode: 'folders' });
      setData(result);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(initialPath); }, [load, initialPath]);

  const navigate = (path) => load(path);

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-widest opacity-70">Current folder</p>
          <p className="text-sm font-mono text-hud-accent truncate">{data?.resolvedPath || '...'}</p>
        </div>
        <button
          type="button"
          onClick={() => setSelectedPath(data?.resolvedPath ?? null)}
          disabled={!data}
          className="px-2 py-1 text-xs uppercase tracking-widest border border-hud-accent text-hud-accent hover:bg-hud-accent/20"
        >
          Pick this folder
        </button>
      </div>

      {data?.parent && (
        <BrowserRow entry={{ name: '..', kind: 'directory', fullPath: data.parent }} onNavigate={navigate} />
      )}

      {loading && <p className="opacity-70 text-sm py-4">Loading...</p>}
      {error && <p className="text-hud-warn text-sm py-4">{error.message}</p>}

      {data && !loading && (
        <div className="max-h-96 overflow-y-auto border border-hud-border">
          {data.entries.map(entry => (
            <BrowserRow key={entry.fullPath} entry={entry} onNavigate={navigate} />
          ))}
          {data.entries.length === 0 && (
            <p className="text-xs opacity-50 p-3 text-center">No subfolders here.</p>
          )}
        </div>
      )}

      <div className="mt-4 flex items-center justify-between">
        <button type="button" onClick={onBack} className="px-3 py-2 border border-hud-border text-hud-accent text-xs uppercase tracking-widest">
          Back
        </button>
        <p className="text-xs opacity-70">{selectedPath ? `Selected: ${selectedPath}` : 'None selected'}</p>
        <button
          type="button"
          onClick={() => selectedPath && onScan(selectedPath)}
          disabled={!selectedPath}
          className={`px-3 py-2 text-xs uppercase tracking-widest ${!selectedPath ? 'border border-hud-border opacity-40 cursor-not-allowed' : 'bg-hud-accent text-hud-bg font-bold'}`}
        >
          Scan →
        </button>
      </div>
    </div>
  );
}
