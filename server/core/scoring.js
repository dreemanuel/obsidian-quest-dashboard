const BASE_XP_RULES = [
  { match: (lane) => lane === 'TO DO - TODAY !', xp: 30 },
  { match: (lane) => /JOB SEARCH/i.test(lane), xp: 25 },
  { match: (lane) => lane === 'DEV - VENERA 🔺' || lane === 'DEV - CODAIC', xp: 20 },
  { match: (lane) => lane === 'DEV - PERSONAL', xp: 15 },
  { match: (lane) => lane === 'TO DO - BACKBURNER', xp: 5 },
];

const FALLBACK_XP = 10;

const XP_TAG_REGEX = /#xp(\d+)\b/;

export function computeXp({ title, rawLane }) {
  const tagMatch = title.match(XP_TAG_REGEX);
  if (tagMatch) {
    const xp = Math.max(0, parseInt(tagMatch[1], 10));
    return { xp, xpSource: 'tag' };
  }
  const base = baseXpForLane(rawLane);
  const modifierTotal = computeModifiers(title);
  return { xp: base + modifierTotal, xpSource: 'auto' };
}

function baseXpForLane(rawLane) {
  for (const rule of BASE_XP_RULES) {
    if (rule.match(rawLane)) return rule.xp;
  }
  return FALLBACK_XP;
}

function computeModifiers(title) {
  let total = 0;
  if (title.includes('🔥')) total += 10;
  if (title.includes('⭐')) total += 5;
  if (title.includes('🔺')) total += 10;
  if (/\bURGENT\b/i.test(title) || /\bTODAY\b/i.test(title)) total += 5;
  return total;
}

export function deriveFlags(title) {
  const flags = [];
  if (title.includes('🔥')) flags.push('urgent');
  if (title.includes('⭐')) flags.push('starred');
  if (title.includes('🔺')) flags.push('critical');
  return flags;
}

export function stripXpTag(title) {
  return title.replace(XP_TAG_REGEX, '').replace(/\s+/g, ' ').trim();
}
