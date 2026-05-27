import { describe, test, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ActivityTracker } from '../components/ActivityTracker.jsx';

function makeData(length = 182, xpAt = {}) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const items = [];
  for (let i = length - 1; i >= 0; i--) {
    const d = new Date(today.getTime() - i * 24 * 60 * 60 * 1000);
    const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    items.push({ date: iso, xp: xpAt[length - 1 - i] ?? 0 });
  }
  return items;
}

describe('ActivityTracker', () => {
  test('renders exactly 182 tiles', () => {
    render(<ActivityTracker dailyActivity={makeData(182)} dailyTarget={50} />);
    const tiles = screen.getAllByTitle(/^\d{4}-\d{2}-\d{2}/);
    expect(tiles).toHaveLength(182);
  });

  test('empty-XP day gets bucket-0 class', () => {
    const data = makeData(182, { 50: 0 });
    render(<ActivityTracker dailyActivity={data} dailyTarget={50} />);
    const tile = screen.getByTitle(new RegExp(`${data[50].date}`));
    expect(tile.className).toContain('bg-hud-border/30');
  });

  test('day exceeding 125% of target gets bucket-4 class (full opacity)', () => {
    const data = makeData(182, { 50: 100 });
    render(<ActivityTracker dailyActivity={data} dailyTarget={50} />);
    const tile = screen.getByTitle(new RegExp(`${data[50].date}`));
    expect(tile.className).toMatch(/bg-hud-accent(?!\/)/);
  });

  test('around-target day (90% of target) gets bucket-3 class', () => {
    const data = makeData(182, { 50: 45 });
    render(<ActivityTracker dailyActivity={data} dailyTarget={50} />);
    const tile = screen.getByTitle(new RegExp(`${data[50].date}`));
    expect(tile.className).toContain('bg-hud-accent/75');
  });

  test('future-date tile gets bucket-0 class regardless of xp value', () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const future = new Date(today.getTime() + 2 * 24 * 60 * 60 * 1000);
    const futureIso = `${future.getFullYear()}-${String(future.getMonth() + 1).padStart(2, '0')}-${String(future.getDate()).padStart(2, '0')}`;
    const data = [...makeData(181), { date: futureIso, xp: 999 }];
    render(<ActivityTracker dailyActivity={data} dailyTarget={50} />);
    const tile = screen.getByTitle(new RegExp(`${futureIso}`));
    expect(tile.className).toContain('bg-hud-border/30');
  });

  test('tile title contains the date and XP', () => {
    const data = makeData(182, { 50: 27 });
    render(<ActivityTracker dailyActivity={data} dailyTarget={50} />);
    expect(screen.getByTitle(`${data[50].date} — 27 XP`)).toBeInTheDocument();
  });

  test('tile title for future dates says "(future)"', () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const future = new Date(today.getTime() + 1 * 24 * 60 * 60 * 1000);
    const futureIso = `${future.getFullYear()}-${String(future.getMonth() + 1).padStart(2, '0')}-${String(future.getDate()).padStart(2, '0')}`;
    const data = [{ date: futureIso, xp: 0 }];
    render(<ActivityTracker dailyActivity={data} dailyTarget={50} />);
    expect(screen.getByTitle(`${futureIso} — (future)`)).toBeInTheDocument();
  });
});
