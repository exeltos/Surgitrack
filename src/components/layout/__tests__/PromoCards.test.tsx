import {fireEvent, render, screen, waitFor, within} from '@testing-library/react';
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
  // The cards, with the promotion already shown once in front of the screen.
  localStorage.setItem('surgitrack-promos-seen', JSON.stringify(['p1']));
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

  it('shows the picture of the product, and the icon if it cannot be loaded', async () => {
    state.promos = [promo({imageUrl: 'https://example.com/p.png'})];
    const {container} = render(<PromoCards />);
    await screen.findByRole('heading', {name: 'Προϊόν Χ'});
    const image = container.querySelector('img.promo-image') as HTMLImageElement;
    expect(image).toHaveAttribute('src', 'https://example.com/p.png');
    fireEvent.error(image);
    expect(container.querySelector('img.promo-image')).toBeNull();
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

  it('opens a new promotion once in front of the screen, with its picture and button', async () => {
    localStorage.removeItem('surgitrack-promos-seen');
    state.promos = [promo({imageUrl: 'https://example.com/p.png'})];
    const {unmount} = render(<PromoCards />);
    const dialog = await screen.findByRole('dialog', {name: 'Προϊόν Χ'});
    expect(dialog.querySelector('img')).toHaveAttribute('src', 'https://example.com/p.png');
    expect(within(dialog).getByRole('link', {name: /Δείτε/})).toHaveAttribute('href', 'https://example.com/x');
    fireEvent.click(within(dialog).getByRole('button', {name: 'Κλείσιμο'}));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    // Still a card on the Overview, and not in front of the screen again.
    expect(screen.getByRole('heading', {name: 'Προϊόν Χ'})).toBeInTheDocument();
    unmount();
    render(<PromoCards />);
    await screen.findByRole('heading', {name: 'Προϊόν Χ'});
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
