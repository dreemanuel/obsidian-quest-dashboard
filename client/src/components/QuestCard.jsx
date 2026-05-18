import { XpBadge } from './XpBadge.jsx';
import { FlagIcons } from './FlagIcons.jsx';
import { ObjectivesBar } from './ObjectivesBar.jsx';

export function QuestCard({ quest, onClick }) {
  return (
    <button
      type="button"
      onClick={() => onClick(quest)}
      className="group text-left w-full p-3 bg-hud-surface border border-hud-border hover:border-hud-accent transition-colors relative overflow-hidden"
    >
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-sm font-semibold leading-snug line-clamp-2 text-hud-accent">
          {quest.title}
        </h3>
        <XpBadge value={quest.xp} xpSource={quest.xpSource} />
      </div>
      <div className="mt-2 flex items-center gap-2">
        <FlagIcons flags={quest.flags} />
      </div>
      <ObjectivesBar done={quest.objectiveProgress.done} total={quest.objectiveProgress.total} />
    </button>
  );
}
