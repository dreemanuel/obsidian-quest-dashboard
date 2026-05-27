import { useState, useMemo, useCallback } from 'react';
import { useQuests } from './hooks/useQuests.js';
import { useHistory } from './hooks/useHistory.js';
import { useShowCompleted } from './hooks/useShowCompleted.js';
import { useSetupStatus } from './hooks/useSetupStatus.js';
import { HeaderHUD } from './components/HeaderHUD.jsx';
import { CategorySection } from './components/CategorySection.jsx';
import { QuestModal } from './components/QuestModal.jsx';
import { OnboardingFlow } from './components/onboarding/OnboardingFlow.jsx';
import { postComplete } from './lib/api.js';
import { saveSources } from './lib/setupApi.js';

export default function App() {
  const setup = useSetupStatus();
  const { quests, categories, meta, loading, error, refetch, setupNeeded } = useQuests();
  const { history, refetch: refetchHistory } = useHistory();
  const { show: showCompleted, toggle: toggleCompleted } = useShowCompleted();
  const [selectedQuest, setSelectedQuest] = useState(null);
  const [toast, setToast] = useState(null);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const visibleQuests = useMemo(
    () => (showCompleted ? quests : quests.filter(q => !q.completed)),
    [quests, showCompleted]
  );

  const byCategory = useMemo(() => {
    const map = new Map();
    for (const cat of categories) map.set(cat, []);
    for (const q of visibleQuests) {
      if (!map.has(q.category)) map.set(q.category, []);
      map.get(q.category).push(q);
    }
    return map;
  }, [categories, visibleQuests]);

  const showToast = (kind, message, ms = 2500) => {
    setToast({ kind, message });
    setTimeout(() => setToast(null), ms);
  };

  const handleComplete = async (quest) => {
    try {
      const res = await postComplete(quest.id);
      setSelectedQuest(null);
      showToast('success', `+${res.xpAwarded} XP — ${quest.title}`);
      await Promise.all([refetch(), refetchHistory()]);
    } catch (err) {
      if (err.code === 'CONFLICT') {
        setSelectedQuest(null);
        showToast('warn', 'Quest changed in source — refreshing…');
        await refetch();
      } else if (err.code === 'SUBTASKS_INCOMPLETE') {
        showToast('warn', `Complete all objectives first (${err.remaining} remaining)`);
      } else {
        showToast('error', `Error: ${err.message}`);
      }
    }
  };

  const handleObjectiveComplete = async (subtask) => {
    try {
      const res = await postComplete(subtask.id);
      if (res.parentCompleted) {
        setSelectedQuest(null);
        showToast('success', `+${res.xpAwarded} XP — ${res.parent?.title ?? 'Quest complete'}`);
        await Promise.all([refetch(), refetchHistory()]);
      } else {
        showToast('success', `Objective complete: ${subtask.title}`, 1500);
        refetch();
      }
    } catch (err) {
      if (err.code === 'CONFLICT') {
        setSelectedQuest(null);
        showToast('warn', 'Quest changed in source — refreshing…');
        await refetch();
      } else {
        showToast('error', `Error: ${err.message}`);
      }
    }
  };

  const handleOnboardingComplete = useCallback(async () => {
    setSettingsOpen(false);
    await setup.refresh();
    await refetch();
  }, [setup, refetch]);

  const handleRemoveSource = async (filePath) => {
    try {
      const remaining = setup.sources
        .filter(s => s.file !== filePath)
        .map(s => ({
          id: s.id,
          adapter: s.adapter || 'ObsidianAdapter',
          config: { file: s.file, vault: s.vault },
          pollIntervalSec: 60,
        }));
      await saveSources(remaining);
      await setup.refresh();
      await refetch();
      showToast('success', 'Source removed');
    } catch (err) {
      showToast('error', `Error removing source: ${err.message}`);
    }
  };

  const showOnboarding = (setupNeeded || settingsOpen) && !setup.loading;
  const onboardingMode = settingsOpen ? 'settings' : 'first-run';

  if (showOnboarding) {
    return (
      <OnboardingFlow
        mode={onboardingMode}
        existingSources={setup.sources}
        onComplete={handleOnboardingComplete}
        onRemoveSource={handleRemoveSource}
      />
    );
  }

  if ((loading || setup.loading) && quests.length === 0) {
    return <div className="p-8 text-hud-accent">INITIALIZING…</div>;
  }

  if (error && quests.length === 0) {
    return (
      <div className="p-8">
        <p className="text-hud-warn">SYNC FAILURE: {error.message}</p>
        <button onClick={refetch} className="mt-4 px-3 py-2 border border-hud-accent text-hud-accent">RETRY</button>
      </div>
    );
  }

  if (visibleQuests.length === 0) {
    return (
      <>
        <HeaderHUD
          history={history}
          lastSyncAt={meta?.lastSyncAt}
          onRefresh={refetch}
          showCompleted={showCompleted}
          onToggleCompleted={toggleCompleted}
          onOpenSettings={() => setSettingsOpen(true)}
        />
        <div className="p-8 text-center text-hud-accent glow tracking-widest">
          ALL QUESTS COMPLETE — STANDBY FOR NEW OBJECTIVES
        </div>
      </>
    );
  }

  return (
    <>
      <HeaderHUD
        history={history}
        lastSyncAt={meta?.lastSyncAt}
        onRefresh={refetch}
        showCompleted={showCompleted}
        onToggleCompleted={toggleCompleted}
        onOpenSettings={() => setSettingsOpen(true)}
      />

      {meta?.sources?.some(s => s.status === 'error') && (
        <div className="bg-hud-warn/20 border-y border-hud-warn px-4 py-2 text-xs text-hud-warn">
          ⚠ SYNC FAILURE — one or more sources unreachable
        </div>
      )}

      <main className="p-4 max-w-7xl mx-auto">
        {[...byCategory.entries()].map(([cat, list]) => (
          <CategorySection
            key={cat}
            category={cat}
            quests={list}
            onQuestClick={setSelectedQuest}
            featured={cat === 'Daily Quests'}
            dimmed={cat === 'Side Quests'}
          />
        ))}
      </main>

      {selectedQuest && (
        <QuestModal
          quest={selectedQuest}
          onClose={() => setSelectedQuest(null)}
          onComplete={handleComplete}
          onObjectiveComplete={handleObjectiveComplete}
        />
      )}

      {toast && (
        <div className={`fixed bottom-4 right-4 z-50 px-4 py-2 border ${
          toast.kind === 'success' ? 'border-hud-success text-hud-success' :
          toast.kind === 'warn' ? 'border-hud-xp text-hud-xp' :
          'border-hud-warn text-hud-warn'
        } bg-hud-surface`}>
          {toast.message}
        </div>
      )}
    </>
  );
}
