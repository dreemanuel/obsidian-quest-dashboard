const LANE_HEADER_RE = /^##\s+(.+)$/;
const TASK_LINE_RE = /^(\s*)-\s+\[( |x)\]\s+(.+)$/;
const COMPLETION_DATE_RE = /✅\s*(\d{4}-\d{2}-\d{2})/;
const SETTINGS_BLOCK_RE = /^%%\s*kanban:settings/;

export function parseBoard(raw) {
  const lines = raw.split('\n');
  const lanes = [];
  let currentLane = null;
  let lastTopLevelTask = null;
  let inSettings = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (SETTINGS_BLOCK_RE.test(line)) {
      inSettings = true;
      continue;
    }
    if (inSettings) continue;

    const laneMatch = line.match(LANE_HEADER_RE);
    if (laneMatch) {
      currentLane = { name: laneMatch[1].trim(), tasks: [] };
      lastTopLevelTask = null;
      lanes.push(currentLane);
      continue;
    }

    if (!currentLane) continue;

    const taskMatch = line.match(TASK_LINE_RE);
    if (!taskMatch) continue;

    const [, indent, mark, body] = taskMatch;
    const completed = mark === 'x';
    const dateMatch = body.match(COMPLETION_DATE_RE);
    const task = {
      title: body.replace(COMPLETION_DATE_RE, '').trim(),
      rawTitle: body,
      completed,
      completedAt: dateMatch ? `${dateMatch[1]}T00:00:00Z` : null,
      line: i,
      objectives: [],
    };

    if (indent.length === 0) {
      currentLane.tasks.push(task);
      lastTopLevelTask = task;
    } else if (lastTopLevelTask) {
      lastTopLevelTask.objectives.push(task);
    }
  }

  return { lanes };
}
