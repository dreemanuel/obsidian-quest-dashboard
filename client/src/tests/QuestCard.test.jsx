import { describe, test, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { QuestCard } from '../components/QuestCard.jsx';

const sampleQuest = {
  id: 'q1',
  title: 'Apply to Vercel',
  xp: 35,
  xpSource: 'auto',
  flags: ['urgent'],
  objectiveProgress: { done: 1, total: 3 },
  completed: false,
};

describe('QuestCard', () => {
  test('renders title, XP, flags', () => {
    render(<QuestCard quest={sampleQuest} onClick={() => {}} />);
    expect(screen.getByText('Apply to Vercel')).toBeInTheDocument();
    expect(screen.getByText(/35/)).toBeInTheDocument();
    expect(screen.getByTitle('Urgent')).toBeInTheDocument();
  });

  test('shows objectives bar when total > 0', () => {
    render(<QuestCard quest={sampleQuest} onClick={() => {}} />);
    expect(screen.getByText(/1\/3/)).toBeInTheDocument();
  });

  test('omits objectives bar when no objectives', () => {
    const quest = { ...sampleQuest, objectiveProgress: { done: 0, total: 0 } };
    render(<QuestCard quest={quest} onClick={() => {}} />);
    expect(screen.queryByText(/Objectives/i)).not.toBeInTheDocument();
  });

  test('fires onClick when card clicked', () => {
    const handler = vi.fn();
    render(<QuestCard quest={sampleQuest} onClick={handler} />);
    fireEvent.click(screen.getByRole('button'));
    expect(handler).toHaveBeenCalledWith(sampleQuest);
  });
});
