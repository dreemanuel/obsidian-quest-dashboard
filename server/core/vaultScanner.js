import { promises as fs } from 'fs';
import path from 'path';

const FRONTMATTER_HEAD_BYTES = 2048;
const KANBAN_MARKER_RE = /^kanban-plugin:\s*board\s*$/m;
const SKIPPED_DIR_NAMES = new Set(['.obsidian', 'node_modules']);
const DEFAULT_SOFT_CAP = 5000;

export async function isKanbanFile(absPath) {
  try {
    const handle = await fs.open(absPath, 'r');
    try {
      const buf = Buffer.alloc(FRONTMATTER_HEAD_BYTES);
      const { bytesRead } = await handle.read(buf, 0, FRONTMATTER_HEAD_BYTES, 0);
      const text = buf.slice(0, bytesRead).toString('utf8');
      return KANBAN_MARKER_RE.test(text);
    } finally {
      await handle.close();
    }
  } catch {
    return false;
  }
}

/**
 * Walk up from a path looking for an ancestor directory that contains a
 * `.obsidian/` subfolder. If found, return that ancestor's basename; else null.
 * If `inputPath` is a file, start the walk from its parent dir.
 */
export async function inferVaultName(inputPath) {
  let dir = inputPath;
  try {
    const stat = await fs.stat(inputPath);
    if (!stat.isDirectory()) dir = path.dirname(inputPath);
  } catch {
    return null;
  }
  let current = dir;
  while (true) {
    try {
      const obsidianMarker = path.join(current, '.obsidian');
      const markerStat = await fs.stat(obsidianMarker);
      if (markerStat.isDirectory()) return path.basename(current);
    } catch {
      // .obsidian/ not here; continue up
    }
    const parent = path.dirname(current);
    if (parent === current) break;
    current = parent;
  }
  return null;
}

/**
 * Recursively walk `rootPath`, returning all kanban-plugin board files found.
 * Skips .obsidian/, hidden dirs (starting with '.'), and node_modules/.
 * Has a soft cap on the number of files SCANNED (not just matched).
 */
export async function scanVault(rootPath, opts = {}) {
  const softCap = opts.softCap ?? DEFAULT_SOFT_CAP;
  const boards = [];
  let filesScanned = 0;
  let truncated = false;

  async function walk(dir) {
    if (truncated) return;
    let entries;
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (truncated) return;
      if (entry.isDirectory()) {
        if (entry.name.startsWith('.')) continue;
        if (SKIPPED_DIR_NAMES.has(entry.name)) continue;
        await walk(path.join(dir, entry.name));
      } else if (entry.isFile() && entry.name.endsWith('.md')) {
        if (filesScanned >= softCap) {
          truncated = true;
          return;
        }
        filesScanned += 1;
        const full = path.join(dir, entry.name);
        if (await isKanbanFile(full)) {
          const inferred = await inferVaultName(full);
          boards.push({
            relativePath: path.relative(rootPath, full),
            fullPath: full,
            inferredVault: inferred,
          });
        }
      }
    }
  }

  await walk(rootPath);

  // Detect vaultName for the scan root: does rootPath/.obsidian/ exist?
  let vaultName = null;
  try {
    const obsidianMarker = path.join(rootPath, '.obsidian');
    const st = await fs.stat(obsidianMarker);
    if (st.isDirectory()) vaultName = path.basename(rootPath);
  } catch {
    // not a vault root
  }

  return { vaultName, boards, truncated, filesScanned };
}
