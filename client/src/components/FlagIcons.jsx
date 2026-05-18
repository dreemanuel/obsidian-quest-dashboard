const FLAG_META = {
  urgent: { glyph: '🔥', title: 'Urgent' },
  starred: { glyph: '⭐', title: 'Starred' },
  critical: { glyph: '🔺', title: 'Critical' },
};

export function FlagIcons({ flags = [] }) {
  if (flags.length === 0) return null;
  return (
    <span className="inline-flex gap-1 text-sm">
      {flags.map(flag => {
        const meta = FLAG_META[flag];
        if (!meta) return null;
        return (
          <span key={flag} title={meta.title} aria-label={meta.title}>
            {meta.glyph}
          </span>
        );
      })}
    </span>
  );
}
