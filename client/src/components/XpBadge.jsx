export function XpBadge({ value, xpSource = 'auto' }) {
  const isTag = xpSource === 'tag';
  return (
    <span
      data-testid="xp-badge"
      data-xp-source={xpSource}
      className={`inline-flex items-center px-2 py-0.5 text-xs font-bold border ${
        isTag
          ? 'text-hud-xp border-hud-xp border-dashed glow'
          : 'text-hud-accent border-hud-accent'
      }`}
    >
      {value} XP
    </span>
  );
}
