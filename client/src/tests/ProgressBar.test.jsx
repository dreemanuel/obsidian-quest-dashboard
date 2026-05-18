import { describe, test, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ProgressBar } from '../components/ProgressBar.jsx';

describe('ProgressBar', () => {
  test('renders label, current/target, fill percentage', () => {
    render(<ProgressBar label="DAILY" current={30} target={100} />);
    expect(screen.getByText(/DAILY/)).toBeInTheDocument();
    expect(screen.getByText(/30\s*\/\s*100/)).toBeInTheDocument();
    const fill = screen.getByTestId('progress-fill');
    expect(fill).toHaveStyle({ width: '30%' });
  });

  test('caps fill at 100% even when current exceeds target', () => {
    render(<ProgressBar label="X" current={150} target={100} />);
    const fill = screen.getByTestId('progress-fill');
    expect(fill).toHaveStyle({ width: '100%' });
  });

  test('renders marker line when ambitionTarget provided', () => {
    render(<ProgressBar label="X" current={30} target={50} ambitionTarget={80} />);
    expect(screen.getByTestId('ambition-marker')).toBeInTheDocument();
  });
});
