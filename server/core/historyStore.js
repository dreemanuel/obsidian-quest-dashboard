import { promises as fs } from 'fs';
import path from 'path';

export function createHistoryStore(filePath) {
  return {
    async appendEvent(event) {
      await fs.mkdir(path.dirname(filePath), { recursive: true });
      const line = JSON.stringify(event) + '\n';
      await fs.appendFile(filePath, line);
    },

    async appendBatch(events) {
      if (events.length === 0) return;
      await fs.mkdir(path.dirname(filePath), { recursive: true });
      const block = events.map(e => JSON.stringify(e)).join('\n') + '\n';
      await fs.appendFile(filePath, block);
    },

    async readAll() {
      try {
        const raw = await fs.readFile(filePath, 'utf8');
        return raw
          .trim()
          .split('\n')
          .filter(l => l.length > 0)
          .map(l => JSON.parse(l));
      } catch (err) {
        if (err.code === 'ENOENT') return [];
        throw err;
      }
    },
  };
}
