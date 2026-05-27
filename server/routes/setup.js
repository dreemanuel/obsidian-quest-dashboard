import { Router } from 'express';
import path from 'path';
import { promises as fs } from 'fs';
import os from 'os';
import { assertPathSafe } from '../core/pathGuard.js';
import { isKanbanFile, inferVaultName } from '../core/vaultScanner.js';

export function createSetupRoute({ rootDir, aggregator, adapterRegistry }) {
  const router = Router();

  router.get('/status', async (req, res, next) => {
    try {
      const sources = await readSourcesFromDisk(rootDir);
      res.json({
        setupNeeded: sources.length === 0,
        sources: sources.map(s => ({
          id: s.id,
          adapter: s.adapter,
          file: s.config.file,
          vault: s.config.vault,
        })),
      });
    } catch (err) {
      next(err);
    }
  });

  const BROWSE_CAP = 500;

  router.get('/browse', async (req, res, next) => {
    try {
      const mode = req.query.mode;
      if (mode !== 'files' && mode !== 'folders') {
        return res.status(400).json({ error: 'invalid_mode', message: 'mode must be "files" or "folders"' });
      }
      const inputPath = req.query.path || os.homedir();
      let canonical;
      try {
        canonical = await assertPathSafe(inputPath);
      } catch (err) {
        if (err.code === 'PATH_OUT_OF_BOUNDS') {
          return res.status(403).json({ error: 'path_out_of_bounds', message: err.message });
        }
        if (err.code === 'PATH_NOT_FOUND') {
          return res.status(400).json({ error: 'path_not_found', message: err.message });
        }
        throw err;
      }

      const stat = await fs.stat(canonical);
      if (!stat.isDirectory()) {
        return res.status(400).json({ error: 'not_a_directory', message: `${canonical} is not a directory` });
      }

      const rawEntries = await fs.readdir(canonical, { withFileTypes: true });
      const dirs = [];
      const files = [];
      for (const entry of rawEntries) {
        const fullPath = path.join(canonical, entry.name);
        if (entry.isDirectory()) {
          const out = { name: entry.name, fullPath, kind: 'directory' };
          if (mode === 'folders') {
            out.hasObsidianMarker = await dirHasObsidianMarker(fullPath);
          }
          dirs.push(out);
        } else if (entry.isFile() && mode === 'files' && entry.name.endsWith('.md')) {
          const out = { name: entry.name, fullPath, kind: 'file' };
          out.isKanban = await isKanbanFile(fullPath);
          if (out.isKanban) {
            out.inferredVault = await inferVaultName(fullPath);
          }
          files.push(out);
        }
      }

      dirs.sort((a, b) => a.name.localeCompare(b.name));
      files.sort((a, b) => a.name.localeCompare(b.name));
      const combined = [...dirs, ...files];
      const truncated = combined.length > BROWSE_CAP;
      const limited = truncated ? combined.slice(0, BROWSE_CAP) : combined;

      const parent = canonical === '/' ? null : path.dirname(canonical);

      res.json({
        resolvedPath: canonical,
        parent,
        entries: limited,
        truncated,
      });
    } catch (err) {
      next(err);
    }
  });

  return router;
}

async function dirHasObsidianMarker(dirPath) {
  try {
    const st = await fs.stat(path.join(dirPath, '.obsidian'));
    return st.isDirectory();
  } catch {
    return false;
  }
}

async function readSourcesFromDisk(rootDir) {
  const sourcesPath = path.join(rootDir, 'config', 'sources.json');
  try {
    const raw = await fs.readFile(sourcesPath, 'utf8');
    const parsed = JSON.parse(raw);
    return parsed.sources || [];
  } catch (err) {
    if (err.code === 'ENOENT') return [];
    throw err;
  }
}
