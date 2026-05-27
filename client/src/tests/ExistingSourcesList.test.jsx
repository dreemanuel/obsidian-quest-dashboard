import { describe, test, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ExistingSourcesList } from '../components/onboarding/ExistingSourcesList.jsx';

const sampleSources = [
  { id: 'obsidian', file: '/home/u/vault/board.md', vault: 'MyVault' },
  { id: 'obsidian-2', file: '/home/u/vault/other.md', vault: 'MyVault' },
];

describe('ExistingSourcesList', () => {
  test('renders nothing when sources is empty', () => {
    const { container } = render(<ExistingSourcesList sources={[]} onRemove={() => {}} />);
    expect(container.firstChild).toBeNull();
  });

  test('renders each source with file path and vault', () => {
    render(<ExistingSourcesList sources={sampleSources} onRemove={() => {}} />);
    expect(screen.getByText('/home/u/vault/board.md')).toBeInTheDocument();
    expect(screen.getByText('/home/u/vault/other.md')).toBeInTheDocument();
    expect(screen.getAllByText(/MyVault/)).toHaveLength(2);
  });

  test('calls onRemove with the source file path when X clicked', () => {
    const onRemove = vi.fn();
    render(<ExistingSourcesList sources={sampleSources} onRemove={onRemove} />);
    const removeButtons = screen.getAllByRole('button', { name: /remove/i });
    fireEvent.click(removeButtons[0]);
    expect(onRemove).toHaveBeenCalledWith('/home/u/vault/board.md');
  });
});
