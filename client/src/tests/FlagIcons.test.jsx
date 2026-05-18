import { describe, test, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { FlagIcons } from '../components/FlagIcons.jsx';

describe('FlagIcons', () => {
  test('renders nothing when empty', () => {
    const { container } = render(<FlagIcons flags={[]} />);
    expect(container.firstChild).toBeNull();
  });

  test('renders icons for each flag', () => {
    render(<FlagIcons flags={['urgent', 'starred']} />);
    expect(screen.getByTitle('Urgent')).toBeInTheDocument();
    expect(screen.getByTitle('Starred')).toBeInTheDocument();
  });
});
