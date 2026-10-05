import type {ReactNode} from 'react';
import {render, screen, fireEvent, within} from '@testing-library/react';
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
    setup(
      'DEPARTMENT',
      '/department',
      <HelpCenter onClose={() => {}} screens={['/department', '/issues', '/movements']} />,
    );
    expect(screen.getByRole('heading', {level: 1, name: 'Σετ & Εργαλεία τμήματος'})).toBeInTheDocument();
    expect(screen.getByText('ΤΡΕΧΟΥΣΑ ΟΘΟΝΗ')).toBeInTheDocument();
    expect(screen.queryByText('SurgiTrack Studio')).not.toBeInTheDocument();
    expect(screen.queryByText('Stock εργαλείων')).not.toBeInTheDocument();
  });

  it('moves between chapters, shows the glossary and closes', () => {
    const onClose = vi.fn();
    setup('ADMIN', '/tools', <HelpCenter onClose={onClose} screens={['/overview', '/tools', '/sets', '/reports']} />);
    expect(screen.getByRole('heading', {level: 1, name: 'Εργαλεία'})).toBeInTheDocument();
    // Related sections are links at the end of the article.
    const related = screen.getByRole('group', {name: 'Σχετικές ενότητες'});
    fireEvent.click(within(related).getByRole('button', {name: /Σετ εργαλείων/}));
    expect(screen.getByRole('heading', {level: 1, name: 'Σετ εργαλείων'})).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole('button', {name: /^Εργαλεία$/})[0]);
    fireEvent.click(screen.getByRole('button', {name: /Επόμενο/}));
    expect(screen.getByRole('heading', {level: 2, name: 'Τύπος χρήσης'})).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', {name: 'Ορολογία'}));
    expect(screen.getByText('Ζωές / Όριο χρήσεων')).toBeInTheDocument();
    fireEvent.keyDown(window, {key: 'Escape'});
    expect(onClose).toHaveBeenCalled();
  });

  it('explains the record card on detail pages and leaves out screens the user cannot open', () => {
    setup(
      'DEPARTMENT',
      '/tools/t1',
      <HelpCenter onClose={() => {}} screens={['/department', '/issues', '/movements']} />,
    );
    expect(screen.getByRole('heading', {level: 1, name: 'Καρτέλα Σετ / εργαλείου'})).toBeInTheDocument();
    expect(screen.queryByRole('button', {name: /Εργαλεία$/})).not.toBeInTheDocument();
  });

  it('shows the platform admin only the pages open outside a hospital', () => {
    setup('ADMIN', '/studio', <HelpCenter onClose={() => {}} screens={['/studio', '/hospitals']} />);
    expect(screen.getByRole('heading', {level: 1, name: 'SurgiTrack Studio'})).toBeInTheDocument();
    expect(screen.queryByText('Επισκόπηση')).not.toBeInTheDocument();
    expect(screen.queryByText('Αποστείρωση')).not.toBeInTheDocument();
    expect(screen.queryByText('Καρτέλα Σετ / εργαλείου')).not.toBeInTheDocument();
  });

  it('starts with the getting-started guide and gives the admin the go-live path', () => {
    setup(
      'ADMIN',
      '/',
      <HelpCenter onClose={() => {}} screens={['/overview', '/tools', '/sets', '/hospital', '/studio']} />,
    );
    const nav = screen.getByRole('navigation');
    expect(within(nav).getAllByRole('button')[0]).toHaveTextContent('Ξεκινώντας');
    fireEvent.click(within(nav).getByRole('button', {name: /Από την αγορά στη λειτουργία/}));
    expect(screen.getByRole('heading', {level: 1, name: 'Από την αγορά στη λειτουργία'})).toBeInTheDocument();
    // A guide is not a screen: no screen to open.
    expect(screen.queryByRole('button', {name: /Άνοιγμα οθόνης/})).not.toBeInTheDocument();
    // Screens opened from Instruments and Sets are listed with them.
    expect(within(nav).getByRole('button', {name: /Μαζική εισαγωγή/})).toBeInTheDocument();
    expect(within(nav).getByRole('button', {name: /Έλεγχος ονομασιών/})).toBeInTheDocument();
  });

  it('opens on the name check rather than the record card', () => {
    setup('ADMIN', '/tools/names', <HelpCenter onClose={() => {}} screens={['/overview', '/tools', '/sets']} />);
    expect(screen.getByRole('heading', {level: 1, name: 'Έλεγχος ονομασιών'})).toBeInTheDocument();
  });

  it('shows department users the start guide but not the admin guides', () => {
    setup(
      'DEPARTMENT',
      '/department',
      <HelpCenter onClose={() => {}} screens={['/department', '/issues', '/movements']} />,
    );
    const nav = screen.getByRole('navigation');
    expect(within(nav).getByRole('button', {name: /Ξεκινώντας/})).toBeInTheDocument();
    expect(within(nav).queryByRole('button', {name: /Από την αγορά/})).not.toBeInTheDocument();
    expect(within(nav).queryByRole('button', {name: /Μαζική εισαγωγή/})).not.toBeInTheDocument();
  });

  it('tells who to contact for support', () => {
    setup('DEPARTMENT', '/department', <HelpCenter onClose={() => {}} screens={['/department']} />);
    fireEvent.click(screen.getByRole('button', {name: 'Υποστήριξη'}));
    expect(screen.getByRole('heading', {level: 1, name: 'Χρειάζεστε βοήθεια;'})).toBeInTheDocument();
    expect(screen.getByRole('link', {name: 'info@exeltos.com'})).toHaveAttribute('href', 'mailto:info@exeltos.com');
    expect(screen.getByRole('link', {name: /Αποστολή email/}).getAttribute('href')).toMatch(
      /^mailto:info@exeltos\.com\?subject=/,
    );
  });
});
