import { useEffect, useState, useMemo } from 'react';
import { XpBadge } from './XpBadge.jsx';
import { ObjectivesBar } from './ObjectivesBar.jsx';

export function QuestModal({ quest, onClose, onComplete, onObjectiveComplete }) {
  const [liveObjectives, setLiveObjectives] = useState(quest.objectives || []);

  useEffect(() => {
    setLiveObjectives(quest.objectives || []);
  }, [quest.objectives]);

  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const liveDone = useMemo(() => liveObjectives.filter(o => o.completed).length, [liveObjectives]);
  const liveTotal = liveObjectives.length;
  const hasObjectives = liveTotal > 0;
  const allDone = hasObjectives && liveDone === liveTotal;
  const parentButtonDisabled = hasObjectives && !allDone;

  const handleObjectiveClick = (obj) => {
    setLiveObjectives(prev =>
      prev.map(o => (o.id === obj.id ? { ...o, completed: true } : o))
    );
    onObjectiveComplete(obj);
  };

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

        {hasObjectives && (
          <div className="my-4">
            <p className="text-xs uppercase tracking-widest opacity-70 mb-2">Objectives</p>
            <ObjectivesBar done={liveDone} total={liveTotal} />
            <ul className="space-y-1 mt-3">
              {liveObjectives.map(obj => (
                <li key={obj.id} className="text-sm">
                  {obj.completed ? (
                    <span className="flex items-center gap-2">
                      <span aria-hidden>☑</span>
                      <span className="line-through opacity-60">{obj.title}</span>
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleObjectiveClick(obj)}
                      className="flex items-center gap-2 text-left w-full hover:text-hud-success"
                    >
                      <span aria-hidden>☐</span>
                      <span>{obj.title}</span>
                    </button>
                  )}
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
            onClick={() => !parentButtonDisabled && onComplete(quest)}
            disabled={parentButtonDisabled}
            className={`flex-1 px-3 py-2 font-bold uppercase tracking-widest text-xs ${
              parentButtonDisabled
                ? 'bg-hud-border text-hud-bg/50 cursor-not-allowed'
                : 'bg-hud-accent text-hud-bg hover:brightness-110'
            }`}
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

        {parentButtonDisabled && (
          <p className="mt-2 text-[10px] uppercase tracking-widest opacity-70 text-center">
            Complete all objectives first
          </p>
        )}
      </div>
    </div>
  );
}
