import { describe, test, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CompletedQuestCard } from '../components/CompletedQuestCard.jsx';

describe('CompletedQuestCard', () => {
  test('renders title with strikethrough class', () => {
    render(<CompletedQuestCard quest={{ id: 'x', title: 'Done thing', completedAt: '2026-05-15T00:00:00Z' }} />);
    expect(screen.getByText('Done thing').className).toContain('line-through');
  });

  test('shows completion date', () => {
    render(<CompletedQuestCard quest={{ id: 'x', title: 'Done', completedAt: '2026-05-15T00:00:00Z' }} />);
    expect(screen.getByText(/2026-05-15/)).toBeInTheDocument();
  });
});
