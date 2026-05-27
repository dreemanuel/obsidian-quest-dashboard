import { describe, test, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BrowserRow } from '../components/onboarding/BrowserRow.jsx';

describe('BrowserRow', () => {
  test('renders directory entry with folder icon, calls onNavigate on click', () => {
    const onNavigate = vi.fn();
    render(<BrowserRow entry={{ name: 'Docs', kind: 'directory', fullPath: '/x/Docs' }} onNavigate={onNavigate} />);
    fireEvent.click(screen.getByText('Docs'));
    expect(onNavigate).toHaveBeenCalledWith('/x/Docs');
  });

  test('shows (vault) badge when hasObsidianMarker is true', () => {
    render(<BrowserRow entry={{ name: 'MyNotes', kind: 'directory', fullPath: '/x/MyNotes', hasObsidianMarker: true }} onNavigate={() => {}} />);
    expect(screen.getByText(/vault/i)).toBeInTheDocument();
  });

  test('shows kanban badge for isKanban file, clickable when allowed', () => {
    const onToggle = vi.fn();
    render(<BrowserRow entry={{ name: 'board.md', kind: 'file', fullPath: '/x/board.md', isKanban: true }} selectable selected={false} onToggle={onToggle} />);
    expect(screen.getByText(/kanban/i)).toBeInTheDocument();
    fireEvent.click(screen.getByText('board.md'));
    expect(onToggle).toHaveBeenCalledWith('/x/board.md');
  });

  test('non-kanban file renders greyed out, not clickable', () => {
    const onToggle = vi.fn();
    render(<BrowserRow entry={{ name: 'note.md', kind: 'file', fullPath: '/x/note.md', isKanban: false }} selectable selected={false} onToggle={onToggle} />);
    fireEvent.click(screen.getByText('note.md'));
    expect(onToggle).not.toHaveBeenCalled();
  });
});
