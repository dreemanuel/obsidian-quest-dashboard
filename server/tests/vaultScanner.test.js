import { describe, test, expect } from 'vitest';
import path from 'path';
import { fileURLToPath } from 'url';
import { scanVault, inferVaultName, isKanbanFile } from '../core/vaultScanner.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const VAULT = path.join(__dirname, 'fixtures', 'vault-tree');

describe('isKanbanFile', () => {
  test('returns true for a file with kanban-plugin: board frontmatter', async () => {
    expect(await isKanbanFile(path.join(VAULT, 'Tasks', 'board.md'))).toBe(true);
  });
  test('returns false for a regular markdown note', async () => {
    expect(await isKanbanFile(path.join(VAULT, 'Notes', 'regular.md'))).toBe(false);
  });
  test('returns false for a non-existent file', async () => {
    expect(await isKanbanFile(path.join(VAULT, 'nope.md'))).toBe(false);
  });
});

describe('inferVaultName', () => {
  test('returns vault basename when path is the vault root', async () => {
    expect(await inferVaultName(VAULT)).toBe('vault-tree');
  });
  test('returns vault basename when walking up from a nested file', async () => {
    expect(await inferVaultName(path.join(VAULT, 'Tasks', 'board.md'))).toBe('vault-tree');
  });
  test('returns null when no .obsidian/ found on walk-up', async () => {
    const noVault = path.join(__dirname, 'fixtures');
    expect(await inferVaultName(noVault)).toBe(null);
  });
});

describe('scanVault', () => {
  test('finds kanban-marker files and skips .obsidian/, hidden, node_modules/', async () => {
    const result = await scanVault(VAULT);
    expect(result.vaultName).toBe('vault-tree');
    expect(result.truncated).toBe(false);
    const titles = result.boards.map(b => b.relativePath).sort();
    expect(titles).toEqual(['Tasks/board.md', 'Tasks/other-board.md']);
  });

  test('returns null vaultName when scanned path has no .obsidian/', async () => {
    const parentOfVault = path.dirname(VAULT);
    const result = await scanVault(parentOfVault);
    expect(result.vaultName).toBe(null);
  });

  test('respects soft cap and sets truncated flag', async () => {
    const result = await scanVault(VAULT, { softCap: 1 });
    expect(result.truncated).toBe(true);
    expect(result.boards.length).toBeLessThanOrEqual(1);
  });
});
