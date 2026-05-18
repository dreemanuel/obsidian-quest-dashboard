import { promises as fs } from 'fs';
import path from 'path';
import { SyncAdapter, ConflictError } from './SyncAdapter.js';
import { parseBoard, markLineComplete, titleMatches } from '../parsers/kanbanMarkdown.js';
import { createLockManager } from '../core/lockManager.js';
import { createQuest, computeObjectiveProgress } from '../core/questModel.js';

export class ObsidianAdapter extends SyncAdapter {
  constructor({ file, vault }) {
    super();
    this.file = file;
    this.vault = vault;
    this.lockManager = createLockManager();
  }

  getId() {
    return 'obsidian';
  }

  async listQuests() {
    const raw = await fs.readFile(this.file, 'utf8');
    const board = parseBoard(raw);
    const quests = [];

    for (const lane of board.lanes) {
      const laneSlug = slugify(lane.name);
      lane.tasks.forEach((task, idx) => {
        const quest = this._buildQuest(task, lane, laneSlug, idx);
        quests.push(quest);
      });
    }

    return quests;
  }

  _buildQuest(task, lane, laneSlug, idx) {
    const fileSlug = slugify(path.basename(this.file, '.md'));
    const id = `obsidian:${fileSlug}:${laneSlug}:${idx}`;
    const objectives = (task.objectives || []).map((obj, oIdx) => createQuest({
      id: `${id}:obj:${oIdx}`,
      sourceId: 'obsidian',
      sourceRef: { file: this.file, line: obj.line, parentLine: task.line },
      title: obj.title,
      rawLane: lane.name,
      completed: obj.completed,
      completedAt: obj.completedAt,
    }));

    const quest = createQuest({
      id,
      sourceId: 'obsidian',
      sourceRef: { file: this.file, line: task.line, parentLine: null, expectedTitle: task.title },
      title: task.title,
      rawTitle: task.rawTitle,
      rawLane: lane.name,
      completed: task.completed,
      completedAt: task.completedAt,
      objectives,
      deepLink: this._buildDeepLink(),
    });
    quest.objectiveProgress = computeObjectiveProgress(quest);
    return quest;
  }

  _buildDeepLink() {
    const params = new URLSearchParams({ vault: this.vault, file: path.basename(this.file, '.md') });
    return `obsidian://open?${params.toString()}`;
  }

  async markComplete(sourceRef) {
    await this.lockManager.acquire(this.file);
    try {
      const raw = await fs.readFile(this.file, 'utf8');
      const lines = raw.split('\n');
      const line = lines[sourceRef.line];
      if (!line) throw new ConflictError('line_missing');
      if (!titleMatches(line, sourceRef.expectedTitle)) {
        throw new ConflictError('title_mismatch');
      }
      const today = new Date().toISOString().slice(0, 10);
      lines[sourceRef.line] = markLineComplete(line, today);
      await fs.writeFile(this.file, lines.join('\n'));
    } finally {
      await this.lockManager.release(this.file);
    }
  }

  async healthCheck() {
    try {
      await fs.access(this.file, fs.constants.R_OK | fs.constants.W_OK);
      return { status: 'ok' };
    } catch (err) {
      return { status: 'error', lastError: err.message };
    }
  }
}

function slugify(text) {
  return text
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-');
}
