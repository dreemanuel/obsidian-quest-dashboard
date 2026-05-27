import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { FileBrowser } from '../components/onboarding/FileBrowser.jsx';
import * as setupApi from '../lib/setupApi.js';

vi.mock('../lib/setupApi.js');

const sampleResponse = {
  resolvedPath: '/home/u',
  parent: '/home',
  entries: [
    { name: 'Docs', kind: 'directory', fullPath: '/home/u/Docs' },
    { name: 'board.md', kind: 'file', fullPath: '/home/u/board.md', isKanban: true, inferredVault: 'u' },
    { name: 'note.md', kind: 'file', fullPath: '/home/u/note.md', isKanban: false },
  ],
  truncated: false,
};

beforeEach(() => {
  setupApi.browse.mockReset();
  setupApi.browse.mockResolvedValue(sampleResponse);
});

describe('FileBrowser', () => {
  test('fetches and renders entries on mount', async () => {
    render(<FileBrowser onNext={() => {}} onBack={() => {}} />);
    await waitFor(() => expect(screen.getByText('Docs')).toBeInTheDocument());
    expect(screen.getByText('board.md')).toBeInTheDocument();
    expect(screen.getByText('note.md')).toBeInTheDocument();
  });

  test('clicking a directory navigates into it', async () => {
    setupApi.browse
      .mockResolvedValueOnce(sampleResponse)
      .mockResolvedValueOnce({ ...sampleResponse, resolvedPath: '/home/u/Docs', parent: '/home/u', entries: [] });

    render(<FileBrowser onNext={() => {}} onBack={() => {}} />);
    await waitFor(() => expect(screen.getByText('Docs')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Docs'));
    await waitFor(() => expect(setupApi.browse).toHaveBeenLastCalledWith({ path: '/home/u/Docs', mode: 'files' }));
  });

  test('clicking a kanban file selects it; Next is enabled', async () => {
    render(<FileBrowser onNext={() => {}} onBack={() => {}} />);
    await waitFor(() => expect(screen.getByText('board.md')).toBeInTheDocument());
    expect(screen.getByRole('button', { name: /next/i })).toBeDisabled();
    fireEvent.click(screen.getByText('board.md'));
    expect(screen.getByRole('button', { name: /next/i })).not.toBeDisabled();
  });

  test('Next calls onNext with selected files (with inferredVault attached)', async () => {
    const onNext = vi.fn();
    render(<FileBrowser onNext={onNext} onBack={() => {}} />);
    await waitFor(() => expect(screen.getByText('board.md')).toBeInTheDocument());
    fireEvent.click(screen.getByText('board.md'));
    fireEvent.click(screen.getByRole('button', { name: /next/i }));
    expect(onNext).toHaveBeenCalledWith([
      { fullPath: '/home/u/board.md', name: 'board.md', inferredVault: 'u' },
    ]);
  });
});
