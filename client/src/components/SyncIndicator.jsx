import { useEffect, useState } from 'react';

export function SyncIndicator({ lastSyncAt, onRefresh }) {
  const [ago, setAgo] = useState('');

  useEffect(() => {
    if (!lastSyncAt) return;
    const tick = () => {
      const seconds = Math.max(0, Math.floor((Date.now() - new Date(lastSyncAt).getTime()) / 1000));
      if (seconds < 60) setAgo(`${seconds}s ago`);
      else if (seconds < 3600) setAgo(`${Math.floor(seconds / 60)}m ago`);
      else setAgo(`${Math.floor(seconds / 3600)}h ago`);
    };
    tick();
    const id = setInterval(tick, 5000);
    return () => clearInterval(id);
  }, [lastSyncAt]);

  return (
    <span className="text-xs opacity-70 inline-flex items-center gap-2">
      <span>Synced {ago || '—'}</span>
      <button
        type="button"
        onClick={onRefresh}
        className="px-1 border border-hud-border hover:border-hud-accent"
        aria-label="Refresh"
      >
        ⟳
      </button>
    </span>
  );
}
