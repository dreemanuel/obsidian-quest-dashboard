import { describe, test, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ModePicker } from '../components/onboarding/ModePicker.jsx';

describe('ModePicker', () => {
  test('renders two mode buttons', () => {
    render(<ModePicker onPickFiles={() => {}} onPickVault={() => {}} />);
    expect(screen.getByRole('button', { name: /pick specific/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /scan a vault/i })).toBeInTheDocument();
  });

  test('fires onPickFiles when first button clicked', () => {
    const onPickFiles = vi.fn();
    render(<ModePicker onPickFiles={onPickFiles} onPickVault={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: /pick specific/i }));
    expect(onPickFiles).toHaveBeenCalled();
  });

  test('fires onPickVault when second button clicked', () => {
    const onPickVault = vi.fn();
    render(<ModePicker onPickFiles={() => {}} onPickVault={onPickVault} />);
    fireEvent.click(screen.getByRole('button', { name: /scan a vault/i }));
    expect(onPickVault).toHaveBeenCalled();
  });
});
