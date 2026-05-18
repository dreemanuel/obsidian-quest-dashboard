import { describe, test, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { XpBadge } from '../components/XpBadge.jsx';

describe('XpBadge', () => {
  test('renders the XP value', () => {
    render(<XpBadge value={25} xpSource="auto" />);
    expect(screen.getByText(/25/)).toBeInTheDocument();
  });

  test('shows tag indicator when xpSource is tag', () => {
    render(<XpBadge value={50} xpSource="tag" />);
    expect(screen.getByTestId('xp-badge')).toHaveAttribute('data-xp-source', 'tag');
  });
});
