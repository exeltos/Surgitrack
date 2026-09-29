import type {ReactNode} from 'react';
import {render, screen, fireEvent} from '@testing-library/react';
import {MemoryRouter} from 'react-router-dom';
import {beforeEach, describe, expect, it, vi} from 'vitest';
import {AppPreferencesProvider} from '../../AppPreferences';
import {LibraryStoreProvider} from '../../LibraryStore';
import {SurgiProvider} from '../../../store/SurgiStore';
import HelpCenter from '../HelpCenter';

const setup = (role: string, path: string, children: ReactNode) => {
  sessionStorage.setItem('surgitrack-demo-role', role);
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AppPreferencesProvider>
        <LibraryStoreProvider>
          <SurgiProvider dataMode="DEMO">{children}</SurgiProvider>
        </LibraryStoreProvider>
      </AppPreferencesProvider>
    </MemoryRouter>,
  );
};

describe('Help Center', () => {
  beforeEach(() => {
    sessionStorage.clear();
    localStorage.clear();
  });

  it('opens on the current screen and shows only the sections of the role', () => {
    setup('DEPARTMENT', '/department', <HelpCenter onClose={() => {}} />);
    expect(screen.getByRole('heading', {level: 1, name: 'Σετ & Εργαλεία τμήματος'})).toBeInTheDocument();
    expect(screen.getByText('ΤΡΕΧΟΥΣΑ ΟΘΟΝΗ')).toBeInTheDocument();
    expect(screen.queryByText('SurgiTrack Studio')).not.toBeInTheDocument();
    expect(screen.queryByText('Stock εργαλείων')).not.toBeInTheDocument();
  });

  it('moves between chapters, shows the glossary and closes', () => {
    const onClose = vi.fn();
    setup('ADMIN', '/tools', <HelpCenter onClose={onClose} />);
    expect(screen.getByRole('heading', {level: 1, name: 'Εργαλεία'})).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', {name: /Επόμενο/}));
    expect(screen.getByRole('heading', {level: 2, name: 'Τύπος χρήσης'})).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', {name: 'Ορολογία'}));
    expect(screen.getByText('Ζωές / Όριο χρήσεων')).toBeInTheDocument();
    fireEvent.keyDown(window, {key: 'Escape'});
    expect(onClose).toHaveBeenCalled();
  });
});
