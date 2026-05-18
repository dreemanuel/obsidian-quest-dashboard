import { QuestCard } from './QuestCard.jsx';
import { CompletedQuestCard } from './CompletedQuestCard.jsx';

export function CategorySection({ category, quests, onQuestClick, featured = false, dimmed = false }) {
  const active = quests.filter(q => !q.completed);
  const completed = quests.filter(q => q.completed);
  const allHidden = quests.length === 0;
  if (allHidden) return null;

  return (
    <section className={`mb-6 ${dimmed ? 'opacity-60' : ''}`}>
      <div className={`flex items-baseline justify-between mb-2 ${featured ? 'border-b border-hud-accent pb-1' : ''}`}>
        <h2 className={`text-sm uppercase tracking-widest ${featured ? 'text-hud-accent glow' : 'text-hud-accent/80'}`}>
          ▣ {category}
        </h2>
        <span className="text-xs opacity-70">
          {active.length} active{completed.length > 0 ? ` · ${completed.length} done` : ''}
        </span>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {active.map(q => (
          <QuestCard key={q.id} quest={q} onClick={onQuestClick} />
        ))}
        {completed.map(q => (
          <CompletedQuestCard key={q.id} quest={q} />
        ))}
      </div>
    </section>
  );
}
