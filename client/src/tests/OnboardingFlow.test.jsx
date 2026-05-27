import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { OnboardingFlow } from '../components/onboarding/OnboardingFlow.jsx';
import * as setupApi from '../lib/setupApi.js';

vi.mock('../lib/setupApi.js');

beforeEach(() => {
  setupApi.browse.mockReset();
  setupApi.scanVault.mockReset();
  setupApi.saveSources.mockReset();
  setupApi.browse.mockResolvedValue({
    resolvedPath: '/home/u',
    parent: null,
    entries: [
      { name: 'board.md', kind: 'file', fullPath: '/home/u/board.md', isKanban: true, inferredVault: 'u' },
    ],
    truncated: false,
  });
  setupApi.scanVault.mockResolvedValue({
    vaultName: 'V',
    boards: [{ relativePath: 'a.md', fullPath: '/home/u/V/a.md', inferredVault: 'V' }],
    truncated: false,
    filesScanned: 1,
  });
  setupApi.saveSources.mockResolvedValue({ saved: true, sourceCount: 1 });
});

describe('OnboardingFlow', () => {
  test('starts at MODE_PICK', () => {
    render(<OnboardingFlow mode="first-run" existingSources={[]} onComplete={() => {}} />);
    expect(screen.getByRole('button', { name: /pick specific/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /scan a vault/i })).toBeInTheDocument();
  });

  test('settings mode shows ExistingSourcesList', () => {
    const sources = [{ id: 'o', file: '/x.md', vault: 'TestSrc' }];
    render(<OnboardingFlow mode="settings" existingSources={sources} onComplete={() => {}} onRemoveSource={() => {}} />);
    expect(screen.getByText('/x.md')).toBeInTheDocument();
  });

  test('full file-picker flow: MODE_PICK → BROWSE_FILES → REVIEW → SAVING → DONE', async () => {
    const onComplete = vi.fn();
    render(<OnboardingFlow mode="first-run" existingSources={[]} onComplete={onComplete} />);

    fireEvent.click(screen.getByRole('button', { name: /pick specific/i }));
    await waitFor(() => expect(screen.getByText('board.md')).toBeInTheDocument());

    fireEvent.click(screen.getByText('board.md'));
    fireEvent.click(screen.getByRole('button', { name: /next/i }));

    await waitFor(() => expect(screen.getByText('/home/u/board.md')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /confirm/i }));

    await waitFor(() => expect(onComplete).toHaveBeenCalled());
    expect(setupApi.saveSources).toHaveBeenCalled();
  });

  test('vault-scan flow: MODE_PICK → BROWSE_FOLDERS → SCANNING → REVIEW → SAVING → DONE', async () => {
    const onComplete = vi.fn();
    setupApi.browse.mockResolvedValue({
      resolvedPath: '/home/u',
      parent: null,
      entries: [{ name: 'MyVaultDir', kind: 'directory', fullPath: '/home/u/MyVaultDir', hasObsidianMarker: true }],
      truncated: false,
    });

    render(<OnboardingFlow mode="first-run" existingSources={[]} onComplete={onComplete} />);
    fireEvent.click(screen.getByRole('button', { name: /scan a vault/i }));
    await waitFor(() => expect(screen.getByText('MyVaultDir')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /pick this folder/i }));
    fireEvent.click(screen.getByRole('button', { name: /scan/i }));

    await waitFor(() => expect(screen.getByText('/home/u/V/a.md')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /confirm/i }));
    await waitFor(() => expect(onComplete).toHaveBeenCalled());
  });
});
