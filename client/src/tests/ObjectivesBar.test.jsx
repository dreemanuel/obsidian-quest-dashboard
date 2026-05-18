import { describe, test, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ObjectivesBar } from '../components/ObjectivesBar.jsx';

describe('ObjectivesBar', () => {
  test('renders nothing when total is zero', () => {
    const { container } = render(<ObjectivesBar done={0} total={0} />);
    expect(container.firstChild).toBeNull();
  });

  test('shows "done/total Objectives" label', () => {
    render(<ObjectivesBar done={2} total={6} />);
    expect(screen.getByText(/2\/6/)).toBeInTheDocument();
  });

  test('fill percentage matches ratio', () => {
    render(<ObjectivesBar done={3} total={6} />);
    const fill = screen.getByTestId('objectives-fill');
    expect(fill).toHaveStyle({ width: '50%' });
  });
});
