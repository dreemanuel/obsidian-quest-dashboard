import { describe, test, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { QuestModal } from '../components/QuestModal.jsx';

const sampleQuest = {
  id: 'q1',
  title: 'Apply to Vercel',
  xp: 35,
  xpSource: 'auto',
  flags: [],
  category: 'Job Hunt',
  rawLane: '🚀 JOB SEARCH - SAAS COMPANIES',
  deepLink: 'obsidian://open?vault=V&file=board',
  objectives: [
    { id: 'q1:obj:0', title: 'Submit application', completed: false },
    { id: 'q1:obj:1', title: 'Send follow-up', completed: true },
  ],
};

describe('QuestModal', () => {
  test('renders title, category, source attribution, objectives', () => {
    render(<QuestModal quest={sampleQuest} onClose={() => {}} onComplete={() => {}} />);
    expect(screen.getByText('Apply to Vercel')).toBeInTheDocument();
    expect(screen.getByText(/Job Hunt/)).toBeInTheDocument();
    expect(screen.getByText(/JOB SEARCH - SAAS/)).toBeInTheDocument();
    expect(screen.getByText('Submit application')).toBeInTheDocument();
    expect(screen.getByText('Send follow-up')).toBeInTheDocument();
  });

  test('calls onComplete when Mark Complete clicked', () => {
    const onComplete = vi.fn();
    render(<QuestModal quest={sampleQuest} onClose={() => {}} onComplete={onComplete} />);
    fireEvent.click(screen.getByRole('button', { name: /mark complete/i }));
    expect(onComplete).toHaveBeenCalledWith(sampleQuest);
  });

  test('"Open in Obsidian" anchor points to deepLink', () => {
    render(<QuestModal quest={sampleQuest} onClose={() => {}} onComplete={() => {}} />);
    const link = screen.getByRole('link', { name: /open in obsidian/i });
    expect(link).toHaveAttribute('href', sampleQuest.deepLink);
  });

  test('Escape key closes modal', () => {
    const onClose = vi.fn();
    render(<QuestModal quest={sampleQuest} onClose={onClose} onComplete={() => {}} />);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });
});
