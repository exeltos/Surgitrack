import {beforeEach, describe, expect, it, vi} from 'vitest';
import {render, screen, waitFor} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {MemoryRouter, Route, Routes} from 'react-router-dom';

const events = vi.hoisted(() => ({loadDemoEvents: vi.fn()}));
vi.mock('../../../data/cloud/demoEvents', () => events);
vi.mock('../../../data/cloud/identity', () => ({getRealIdentity: () => ({id: 'owner-1'})}));

import OwnerDemoAlerts from '../OwnerDemoAlerts';
import {UnsavedChangesProvider} from '../../../app/UnsavedChanges';

const KEY = 'surgitrack-owner-demo-seen:owner-1';
const renderAlerts = () =>
  render(
    <MemoryRouter initialEntries={['/']}>
      <UnsavedChangesProvider>
        <Routes>
          <Route path="/" element={<OwnerDemoAlerts />} />
          <Route path="/studio" element={<p>Studio</p>} />
        </Routes>
      </UnsavedChangesProvider>
    </MemoryRouter>,
  );

beforeEach(() => {
  localStorage.clear();
  events.loadDemoEvents.mockReset();
});

describe('OwnerDemoAlerts', () => {
  it('starts from now on a first visit: nothing old pops up', async () => {
    renderAlerts();
    await waitFor(() => expect(localStorage.getItem(KEY)).not.toBeNull());
    expect(events.loadDemoEvents).not.toHaveBeenCalled();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('pops up who finished signing up or sent the evaluation, until closed or opened', async () => {
    localStorage.setItem(KEY, '2026-10-12T08:00:00.000Z');
    events.loadDemoEvents.mockResolvedValue([
      {
        id: 'invitation:1',
        kind: 'SIGNED_UP',
        at: '2026-10-12T09:00:00Z',
        hospitalName: 'Γ.Ν. Λάρισας',
        name: 'Μαρία Παππά',
      },
      {
        id: 'evaluation:1',
        kind: 'EVALUATED',
        at: '2026-10-12T09:30:00Z',
        hospitalName: 'Γ.Ν. Λάρισας',
        name: 'Μαρία Παππά',
        nps: 9,
      },
    ]);
    const user = userEvent.setup();
    renderAlerts();
    expect(await screen.findByText('Μαρία Παππά ολοκλήρωσε την εγγραφή στο «Γ.Ν. Λάρισας».')).toBeInTheDocument();
    expect(screen.getByText('Μαρία Παππά ολοκλήρωσε την αξιολόγηση στο «Γ.Ν. Λάρισας».')).toBeInTheDocument();
    expect(screen.getByText('Σύσταση 9/10')).toBeInTheDocument();
    expect(events.loadDemoEvents).toHaveBeenCalledWith('2026-10-12T08:00:00.000Z');
    // Seen up to the newest event: the next check asks only for what came after it.
    expect(localStorage.getItem(KEY)).toBe('2026-10-12T09:30:00Z');
    await user.click(screen.getByRole('button', {name: 'Άνοιγμα Demo'}));
    expect(await screen.findByText('Studio')).toBeInTheDocument();
  });
});
