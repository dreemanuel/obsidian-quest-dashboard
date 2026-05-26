export async function fetchQuests() {
  const res = await fetch('/api/quests');
  if (!res.ok) throw new Error(`fetchQuests failed: ${res.status}`);
  return res.json();
}

export async function fetchHistory() {
  const res = await fetch('/api/history');
  if (!res.ok) throw new Error(`fetchHistory failed: ${res.status}`);
  return res.json();
}

export async function postComplete(questId) {
  const res = await fetch(`/api/quests/${encodeURIComponent(questId)}/complete`, { method: 'POST' });
  if (!res.ok) {
    if (res.status === 409) {
      const err = new Error('quest_changed');
      err.code = 'CONFLICT';
      throw err;
    }
    if (res.status === 422) {
      const body = await res.json().catch(() => ({}));
      const err = new Error('subtasks_incomplete');
      err.code = 'SUBTASKS_INCOMPLETE';
      err.remaining = body.remaining;
      throw err;
    }
    throw new Error(`postComplete failed: ${res.status}`);
  }
  return res.json();
}

export async function fetchHealth() {
  const res = await fetch('/api/health');
  if (!res.ok) throw new Error(`fetchHealth failed: ${res.status}`);
  return res.json();
}
