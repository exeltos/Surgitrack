import {render, screen, fireEvent} from '@testing-library/react';
import {MemoryRouter} from 'react-router-dom';
import {beforeEach, describe, expect, it, vi} from 'vitest';

const who = vi.hoisted(() => ({platform: false, mode: 'PRODUCTION'}));
vi.mock('../../../data/cloud/identity', async original => ({
  ...(await original<typeof import('../../../data/cloud/identity')>()),
  getRealIdentity: () => ({id: 'u1', name: 'Owner', role: 'ADMIN', platform: who.platform}),
}));
vi.mock('../../../config/dataMode', async original => ({
  ...(await original<typeof import('../../../config/dataMode')>()),
  getRuntimeDataMode: () => who.mode,
}));

const {AppPreferencesProvider} = await import('../../AppPreferences');
const {LibraryStoreProvider} = await import('../../LibraryStore');
const {SurgiProvider} = await import('../../../store/SurgiStore');
const {default: HelpCenter} = await import('../HelpCenter');

const open = () =>
  render(
    <MemoryRouter initialEntries={['/studio']}>
      <AppPreferencesProvider>
        <LibraryStoreProvider>
          <SurgiProvider dataMode="DEMO">
            <HelpCenter onClose={() => {}} screens={['/studio']} />
          </SurgiProvider>
        </LibraryStoreProvider>
      </AppPreferencesProvider>
    </MemoryRouter>,
  );

describe('PDF manuals in the Help Center', () => {
  beforeEach(() => {
    sessionStorage.clear();
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        Response.json({
          el: {file: 'SurgiTrack-manual-el.pdf', pages: 44, bytes: 2306867, version: '0.29.6', built: '2026-10-09'},
        }),
      ),
    );
  });

  it('are offered to the platform owner, with download, send and copy', async () => {
    who.platform = true;
    who.mode = 'PRODUCTION';
    open();
    fireEvent.click(screen.getByRole('button', {name: 'Εγχειρίδια PDF'}));
    expect(await screen.findByText(/44 σελίδες · 2\.2 MB/)).toBeInTheDocument();
    expect(screen.getByRole('link', {name: 'Λήψη'})).toHaveAttribute('href', '/manuals/SurgiTrack-manual-el.pdf');
    expect(screen.getByRole('button', {name: 'Αποστολή'})).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Αντιγραφή συνδέσμου'})).toBeInTheDocument();
  });

  it('are hidden from everyone else and from the owner inside the Demo', () => {
    who.platform = false;
    who.mode = 'PRODUCTION';
    const first = open();
    expect(screen.queryByRole('button', {name: 'Εγχειρίδια PDF'})).not.toBeInTheDocument();
    first.unmount();
    who.platform = true;
    who.mode = 'DEMO';
    open();
    expect(screen.queryByRole('button', {name: 'Εγχειρίδια PDF'})).not.toBeInTheDocument();
  });
});
