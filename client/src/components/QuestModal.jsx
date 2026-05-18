import { useEffect } from 'react';
import { XpBadge } from './XpBadge.jsx';

export function QuestModal({ quest, onClose, onComplete }) {
  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 bg-hud-bg/80 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-hud-surface border border-hud-accent max-w-lg w-full p-5 relative"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute top-2 right-2 text-hud-border hover:text-hud-accent"
        >
          ✕
        </button>

        <div className="flex items-start justify-between gap-3 mb-3">
          <div>
            <h2 className="text-lg font-bold text-hud-accent">{quest.title}</h2>
            <p className="text-xs uppercase tracking-widest opacity-70 mt-1">
              {quest.category}
            </p>
          </div>
          <XpBadge value={quest.xp} xpSource={quest.xpSource} />
        </div>

        {quest.objectives?.length > 0 && (
          <div className="my-4">
            <p className="text-xs uppercase tracking-widest opacity-70 mb-2">Objectives</p>
            <ul className="space-y-1">
              {quest.objectives.map(obj => (
                <li key={obj.id} className="text-sm flex items-center gap-2">
                  <span aria-hidden>{obj.completed ? '☑' : '☐'}</span>
                  <span className={obj.completed ? 'line-through opacity-60' : ''}>
                    {obj.title}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <p className="text-[10px] uppercase tracking-widest opacity-60 mb-4">
          Source: Obsidian → {quest.rawLane}
        </p>

        <div className="flex gap-2 mt-4">
          <button
            type="button"
            onClick={() => onComplete(quest)}
            className="flex-1 px-3 py-2 bg-hud-accent text-hud-bg font-bold uppercase tracking-widest text-xs hover:brightness-110"
          >
            ▣ Mark Complete
          </button>
          <a
            href={quest.deepLink}
            target="_blank"
            rel="noreferrer"
            className="flex-1 px-3 py-2 border border-hud-border text-hud-accent text-center text-xs uppercase tracking-widest hover:border-hud-accent"
          >
            ↗ Open in Obsidian
          </a>
        </div>
      </div>
    </div>
  );
}
