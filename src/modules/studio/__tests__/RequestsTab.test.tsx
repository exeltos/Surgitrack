import {beforeEach, describe, expect, it, vi} from 'vitest';
import {fireEvent, render, screen, within} from '@testing-library/react';
import RequestsTab from '../tabs/RequestsTab';
import {loadContactRequests, setContactRequestHandled} from '../../../data/cloud/contactRequests';
import type {StudioPageState} from '../useStudioPage';

vi.mock('../../../data/cloud/contactRequests', () => ({
  CONTACT_PAGE: 50,
  loadContactRequests: vi.fn(),
  countContactRequests: vi.fn(async () => ({open: 1, all: 2})),
  setContactRequestHandled: vi.fn(async () => undefined),
  deleteContactRequest: vi.fn(async () => undefined),
}));

const REQUESTS = [
  {
    id: 'r1',
    createdAt: '2026-11-14T09:00:00Z',
    name: 'Μαρία Παπαδάκη',
    organization: 'Γενικό Νοσοκομείο',
    role: 'Προϊσταμένη',
    email: 'maria@example.test',
    phone: '210 000 0000',
    message: 'Θα θέλαμε παρουσίαση.',
  },
  {
    id: 'r2',
    createdAt: '2026-11-13T09:00:00Z',
    name: 'Γιώργος',
    email: 'g@example.test',
    message: 'Ευχαριστώ',
    handledAt: '2026-11-13T10:00:00Z',
  },
];
const studio = (tab = 'REQUESTS') => ({L: (el: string) => el, platformAdmin: true, tab}) as unknown as StudioPageState;

beforeEach(() => {
  // The database filters: «Νέα» asks for the unhandled ones only.
  vi.mocked(loadContactRequests).mockImplementation(async view =>
    view === 'NEW' ? REQUESTS.filter(r => !r.handledAt) : REQUESTS,
  );
  vi.mocked(setContactRequestHandled).mockClear();
});

describe('Studio → Αιτήματα παρουσίασης', () => {
  it('shows the new requests with how to reach the sender, and marks one handled', async () => {
    render(<RequestsTab s={studio()} />);
    const card = (await screen.findByText('Θα θέλαμε παρουσίαση.')).closest('li') as HTMLElement;
    expect(within(card).getByRole('link', {name: 'maria@example.test'})).toHaveAttribute(
      'href',
      'mailto:maria@example.test',
    );
    expect(within(card).getByRole('link', {name: '210 000 0000'})).toHaveAttribute('href', 'tel:2100000000');
    // The handled one waits under «Όλα».
    expect(screen.queryByText('Ευχαριστώ')).toBeNull();
    fireEvent.click(within(card).getByRole('button', {name: 'Ολοκληρώθηκε'}));
    await vi.waitFor(() => expect(setContactRequestHandled).toHaveBeenCalledWith('r1', true));
    expect(loadContactRequests).toHaveBeenCalledWith('NEW');
    expect(screen.getByRole('button', {name: /Νέα/})).toHaveTextContent('1');
    fireEvent.click(screen.getByRole('button', {name: /Όλα/}));
    expect(await screen.findByText('Ευχαριστώ')).toBeInTheDocument();
    expect(loadContactRequests).toHaveBeenCalledWith('ALL');
    // Fewer than a page: no «Περισσότερα».
    expect(screen.queryByRole('button', {name: 'Περισσότερα'})).toBeNull();
  });

  it('shows nothing on another tab', () => {
    const {container} = render(<RequestsTab s={studio('SYSTEM')} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('pages on with «Περισσότερα», continuing after the last one shown', async () => {
    const page = Array.from({length: 50}, (_, i) => ({...REQUESTS[0], id: `p${i}`, message: `Μήνυμα ${i}`}));
    vi.mocked(loadContactRequests)
      .mockResolvedValueOnce(page)
      .mockResolvedValueOnce([{...REQUESTS[0], id: 'old', message: 'Παλιό αίτημα'}]);
    render(<RequestsTab s={studio()} />);
    fireEvent.click(await screen.findByRole('button', {name: 'Περισσότερα'}));
    expect(await screen.findByText('Παλιό αίτημα')).toBeInTheDocument();
    expect(loadContactRequests).toHaveBeenLastCalledWith('NEW', page[49].createdAt);
    expect(screen.queryByRole('button', {name: 'Περισσότερα'})).toBeNull();
  });
});
