import { describe, test, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { QuestModal } from '../components/QuestModal.jsx';

const baseQuest = {
  id: 'q1',
  title: 'Apply to Vercel',
  xp: 35,
  xpSource: 'auto',
  flags: [],
  category: 'Job Hunt',
  rawLane: '🚀 JOB SEARCH - SAAS COMPANIES',
  deepLink: 'obsidian://open?vault=V&file=board',
  objectives: [],
};

const questWithSubtasks = {
  ...baseQuest,
  objectives: [
    { id: 'q1:obj:0', title: 'Submit application', completed: false },
    { id: 'q1:obj:1', title: 'Send follow-up', completed: true },
  ],
};

describe('QuestModal — header + actions (unchanged behaviors)', () => {
  test('renders title, category, source attribution', () => {
    render(<QuestModal quest={questWithSubtasks} onClose={() => {}} onComplete={() => {}} onObjectiveComplete={() => {}} />);
    expect(screen.getByText('Apply to Vercel')).toBeInTheDocument();
    expect(screen.getByText(/Job Hunt/)).toBeInTheDocument();
    expect(screen.getByText(/JOB SEARCH - SAAS/)).toBeInTheDocument();
  });

  test('"Open in Obsidian" anchor points to deepLink', () => {
    render(<QuestModal quest={questWithSubtasks} onClose={() => {}} onComplete={() => {}} onObjectiveComplete={() => {}} />);
    const link = screen.getByRole('link', { name: /open in obsidian/i });
    expect(link).toHaveAttribute('href', questWithSubtasks.deepLink);
  });

  test('Escape key closes modal', () => {
    const onClose = vi.fn();
    render(<QuestModal quest={questWithSubtasks} onClose={onClose} onComplete={() => {}} onObjectiveComplete={() => {}} />);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });
});

describe('QuestModal — objectives section', () => {
  test('renders ObjectivesBar above the subtask list when objectives exist', () => {
    render(<QuestModal quest={questWithSubtasks} onClose={() => {}} onComplete={() => {}} onObjectiveComplete={() => {}} />);
    expect(screen.getByText(/1\/2/)).toBeInTheDocument();
    expect(screen.getByText('Submit application')).toBeInTheDocument();
    expect(screen.getByText('Send follow-up')).toBeInTheDocument();
  });

  test('no ObjectivesBar when quest has no objectives', () => {
    render(<QuestModal quest={baseQuest} onClose={() => {}} onComplete={() => {}} onObjectiveComplete={() => {}} />);
    expect(screen.queryByText(/\d+\/\d+/)).not.toBeInTheDocument();
  });

  test('clicking an unchecked subtask fires onObjectiveComplete with the subtask', () => {
    const onObjectiveComplete = vi.fn();
    render(<QuestModal quest={questWithSubtasks} onClose={() => {}} onComplete={() => {}} onObjectiveComplete={onObjectiveComplete} />);
    fireEvent.click(screen.getByRole('button', { name: /submit application/i }));
    expect(onObjectiveComplete).toHaveBeenCalledTimes(1);
    expect(onObjectiveComplete.mock.calls[0][0].id).toBe('q1:obj:0');
  });

  test('completed subtask is not a button (not clickable)', () => {
    render(<QuestModal quest={questWithSubtasks} onClose={() => {}} onComplete={() => {}} onObjectiveComplete={() => {}} />);
    expect(screen.queryByRole('button', { name: /send follow-up/i })).toBeNull();
    expect(screen.getByText('Send follow-up')).toBeInTheDocument();
  });

  test('ObjectivesBar reflects optimistic update after subtask click', () => {
    render(<QuestModal quest={questWithSubtasks} onClose={() => {}} onComplete={() => {}} onObjectiveComplete={() => {}} />);
    expect(screen.getByText(/1\/2/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /submit application/i }));
    expect(screen.getByText(/2\/2/)).toBeInTheDocument();
  });
});

describe('QuestModal — parent "Mark Complete" button', () => {
  test('disabled when subtasks remain incomplete', () => {
    render(<QuestModal quest={questWithSubtasks} onClose={() => {}} onComplete={() => {}} onObjectiveComplete={() => {}} />);
    const btn = screen.getByRole('button', { name: /mark complete/i });
    expect(btn).toBeDisabled();
    expect(screen.getByText(/Complete all objectives first/i)).toBeInTheDocument();
  });

  test('enabled when quest has no objectives', () => {
    const onComplete = vi.fn();
    render(<QuestModal quest={baseQuest} onClose={() => {}} onComplete={onComplete} onObjectiveComplete={() => {}} />);
    const btn = screen.getByRole('button', { name: /mark complete/i });
    expect(btn).not.toBeDisabled();
    fireEvent.click(btn);
    expect(onComplete).toHaveBeenCalledWith(baseQuest);
  });

  test('enabled when all objectives are complete (e.g., completed externally)', () => {
    const allDone = {
      ...questWithSubtasks,
      objectives: [
        { id: 'q1:obj:0', title: 'a', completed: true },
        { id: 'q1:obj:1', title: 'b', completed: true },
      ],
    };
    render(<QuestModal quest={allDone} onClose={() => {}} onComplete={() => {}} onObjectiveComplete={() => {}} />);
    const btn = screen.getByRole('button', { name: /mark complete/i });
    expect(btn).not.toBeDisabled();
  });
});
