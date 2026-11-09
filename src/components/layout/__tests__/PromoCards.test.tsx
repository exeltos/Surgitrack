import {fireEvent, render, screen, waitFor} from '@testing-library/react';
import {beforeEach, describe, expect, it, vi} from 'vitest';
import type {PlatformNotice} from '../../../data/cloud/platformNotices';

const state = vi.hoisted(() => ({mode: 'PRODUCTION', promos: [] as unknown[], asked: [] as string[]}));
vi.mock('../../../config/dataMode', () => ({getRuntimeDataMode: () => state.mode}));
vi.mock('../../../data/cloud/platformNotices', async () => {
  const real = await vi.importActual<typeof import('../../../data/cloud/platformNotices')>(
    '../../../data/cloud/platformNotices',
  );
  return {
    ...real,
    loadActiveNotices: async (kind: string) => {
      state.asked.push(kind);
      return state.promos;
    },
  };
});
const {default: PromoCards} = await import('../PromoCards');

const promo = (over: Partial<PlatformNotice>): PlatformNotice => ({
  id: 'p1',
  message: 'Νέο σύστημα ιχνηλάτησης',
  kind: 'PROMO',
  audience: 'ADMINS',
  title: 'Προϊόν Χ',
  linkUrl: 'https://example.com/x',
  linkLabel: 'Δείτε',
  startsAt: '2026-11-01T00:00:00Z',
  createdAt: '2026-11-01T00:00:00Z',
  ...over,
});

beforeEach(() => {
  localStorage.clear();
  state.mode = 'PRODUCTION';
  state.promos = [];
  state.asked = [];
});

describe("the owner's promotions on the administrator's Overview", () => {
  it('shows a card with the title, the text and a link that opens in a new tab', async () => {
    state.promos = [promo({})];
    render(<PromoCards />);
    expect(await screen.findByRole('heading', {name: 'Προϊόν Χ'})).toBeInTheDocument();
    expect(screen.getByText('Νέο σύστημα ιχνηλάτησης')).toBeInTheDocument();
    const link = screen.getByRole('link', {name: /Δείτε/});
    expect(link).toHaveAttribute('href', 'https://example.com/x');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link.getAttribute('rel')).toContain('noopener');
    expect(state.asked).toEqual(['PROMO']);
  });

  it('shows no link that is not https', async () => {
    state.promos = [promo({linkUrl: 'javascript:alert(1)'})];
    render(<PromoCards />);
    await screen.findByRole('heading', {name: 'Προϊόν Χ'});
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });

  it('hides a promotion on this device once it is closed', async () => {
    state.promos = [promo({})];
    const {unmount} = render(<PromoCards />);
    fireEvent.click(await screen.findByRole('button', {name: 'Απόκρυψη πρότασης'}));
    expect(screen.queryByRole('heading', {name: 'Προϊόν Χ'})).not.toBeInTheDocument();
    unmount();
    render(<PromoCards />);
    await waitFor(() => expect(state.asked.length).toBe(2));
    expect(screen.queryByRole('heading', {name: 'Προϊόν Χ'})).not.toBeInTheDocument();
  });

  it('asks for nothing in a Demo or the sample hospital', () => {
    state.mode = 'DEMO';
    state.promos = [promo({})];
    render(<PromoCards />);
    expect(state.asked).toEqual([]);
    expect(screen.queryByRole('heading')).not.toBeInTheDocument();
  });
});
