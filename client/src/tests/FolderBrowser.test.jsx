import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { FolderBrowser } from '../components/onboarding/FolderBrowser.jsx';
import * as setupApi from '../lib/setupApi.js';

vi.mock('../lib/setupApi.js');

const sampleResponse = {
  resolvedPath: '/home/u',
  parent: '/home',
  entries: [
    { name: 'MyKanban', kind: 'directory', fullPath: '/home/u/MyKanban', hasObsidianMarker: true },
    { name: 'Other', kind: 'directory', fullPath: '/home/u/Other', hasObsidianMarker: false },
  ],
  truncated: false,
};

beforeEach(() => {
  setupApi.browse.mockReset();
  setupApi.browse.mockResolvedValue(sampleResponse);
});

describe('FolderBrowser', () => {
  test('renders folders only (single-select)', async () => {
    render(<FolderBrowser onScan={() => {}} onBack={() => {}} />);
    await waitFor(() => expect(screen.getByText('MyKanban')).toBeInTheDocument());
    expect(screen.getByText('Other')).toBeInTheDocument();
    expect(screen.getByText(/vault/i)).toBeInTheDocument();
  });

  test('clicking a folder selects it (and triggers Scan to enable)', async () => {
    render(<FolderBrowser onScan={() => {}} onBack={() => {}} />);
    await waitFor(() => expect(screen.getByText('MyKanban')).toBeInTheDocument());
    expect(screen.getByRole('button', { name: /scan/i })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: /pick this folder/i }));
    expect(screen.getByRole('button', { name: /scan/i })).not.toBeDisabled();
  });

  test('clicking Scan calls onScan with selected path', async () => {
    const onScan = vi.fn();
    render(<FolderBrowser onScan={onScan} onBack={() => {}} />);
    await waitFor(() => expect(screen.getByText('MyKanban')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /pick this folder/i }));
    fireEvent.click(screen.getByRole('button', { name: /scan/i }));
    expect(onScan).toHaveBeenCalledWith('/home/u');
  });
});
