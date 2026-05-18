import { ProgressBar } from './ProgressBar.jsx';
import { StreakBadge } from './StreakBadge.jsx';
import { ShowCompletedToggle } from './ShowCompletedToggle.jsx';
import { SyncIndicator } from './SyncIndicator.jsx';

export function HeaderHUD({ history, lastSyncAt, onRefresh, showCompleted, onToggleCompleted }) {
  const useRolling = history?.useRollingAvg;
  const dailyTarget = useRolling ? (history.rollingAvg7Day?.daily || 1) : (history?.today?.target || 50);
  const weeklyTarget = useRolling ? (history.rollingAvg7Day?.weekly || 1) : (history?.week?.target || 250);

  return (
    <header className="sticky top-0 z-40 bg-hud-bg border-b border-hud-border p-4">
      <div className="flex items-center justify-between mb-3">
        <h1 className="text-xl font-bold tracking-widest text-hud-accent glow">
          ◆ QUEST DASHBOARD
        </h1>
        <div className="flex items-center gap-3">
          <SyncIndicator lastSyncAt={lastSyncAt} onRefresh={onRefresh} />
          <ShowCompletedToggle show={showCompleted} onToggle={onToggleCompleted} />
        </div>
      </div>

      <div className="space-y-2">
        <ProgressBar
          label="Daily"
          current={history?.today?.xp ?? 0}
          target={dailyTarget}
          ambitionTarget={useRolling ? history?.today?.target : null}
          size="lg"
        />
        <ProgressBar
          label="Weekly"
          current={history?.week?.xp ?? 0}
          target={weeklyTarget}
          ambitionTarget={useRolling ? history?.week?.target : null}
          size="sm"
        />
      </div>

      <div className="mt-2 flex items-center gap-4 text-xs">
        <StreakBadge days={history?.streak ?? 0} />
        {useRolling && (
          <span className="opacity-70">
            ↑ Avg: {history.rollingAvg7Day.daily} XP/day
          </span>
        )}
      </div>
    </header>
  );
}
