import { describe, test, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ChecklistReview } from '../components/onboarding/ChecklistReview.jsx';

const candidates = [
  { fullPath: '/home/u/v/a.md', name: 'a.md', inferredVault: 'v' },
  { fullPath: '/home/u/v/b.md', name: 'b.md', inferredVault: 'v' },
  { fullPath: '/home/u/c.md', name: 'c.md', inferredVault: null },
];

describe('ChecklistReview', () => {
  test('renders one row per candidate, all pre-checked', () => {
    render(<ChecklistReview candidates={candidates} onBack={() => {}} onConfirm={() => {}} />);
    expect(screen.getByText('/home/u/v/a.md')).toBeInTheDocument();
    expect(screen.getByText('/home/u/v/b.md')).toBeInTheDocument();
    expect(screen.getByText('/home/u/c.md')).toBeInTheDocument();
    const checkboxes = screen.getAllByRole('checkbox');
    expect(checkboxes.every(c => c.checked)).toBe(true);
  });

  test('unchecking a row excludes it from confirm payload', () => {
    const onConfirm = vi.fn();
    render(<ChecklistReview candidates={candidates} onBack={() => {}} onConfirm={onConfirm} />);
    const checkboxes = screen.getAllByRole('checkbox');
    fireEvent.click(checkboxes[0]);
    fireEvent.click(screen.getByRole('button', { name: /confirm/i }));
    const payload = onConfirm.mock.calls[0][0];
    expect(payload).toHaveLength(2);
    expect(payload.map(p => p.file)).toEqual(['/home/u/v/b.md', '/home/u/c.md']);
  });

  test('confirm button disabled when 0 rows checked', () => {
    render(<ChecklistReview candidates={candidates} onBack={() => {}} onConfirm={() => {}} />);
    const checkboxes = screen.getAllByRole('checkbox');
    checkboxes.forEach(c => fireEvent.click(c));
    expect(screen.getByRole('button', { name: /confirm/i })).toBeDisabled();
  });

  test('vault input pre-filled from inferredVault and editable', () => {
    const onConfirm = vi.fn();
    render(<ChecklistReview candidates={candidates} onBack={() => {}} onConfirm={onConfirm} />);
    const vaultInputs = screen.getAllByPlaceholderText(/vault/i);
    expect(vaultInputs[0].value).toBe('v');
    expect(vaultInputs[2].value).toBe('');
    fireEvent.change(vaultInputs[2], { target: { value: 'MyVault' } });
    fireEvent.click(screen.getByRole('button', { name: /confirm/i }));
    const payload = onConfirm.mock.calls[0][0];
    expect(payload[2].vault).toBe('MyVault');
  });
});
