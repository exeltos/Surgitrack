import type {ReactNode} from 'react';
import {fireEvent, render, screen} from '@testing-library/react';
import {MemoryRouter} from 'react-router-dom';
import {beforeEach, describe, expect, it, vi} from 'vitest';
import {AppPreferencesProvider} from '../../../core/AppPreferences';
import {LibraryStoreProvider} from '../../../core/LibraryStore';
import {SurgiProvider, useSurgi} from '../../../store/SurgiStore';
import AssetLifecycle from '../AssetLifecycle';

const Wrapper = ({children}: {children: ReactNode}) => (
  <MemoryRouter>
    <AppPreferencesProvider>
      <LibraryStoreProvider>
        <SurgiProvider dataMode="DEMO">{children}</SurgiProvider>
      </LibraryStoreProvider>
    </AppPreferencesProvider>
  </MemoryRouter>
);

// A Set the sample hospital has in a running sterilizer load.
const InTheSterilizer = () => {
  const {sets, processLoads} = useSurgi();
  const running = processLoads.find(load => load.kind === 'STERILIZATION' && load.status === 'OPEN');
  const loaded =
    running && sets.find(set => running.items.some(item => item.assetKind === 'SET' && item.assetId === set.id));
  if (!loaded) return <p>no running load</p>;
  return <AssetLifecycle kind="SET" id={loaded.id} state={loaded.state} barcode={loaded.barcode} />;
};

describe('the way round of a Set or instrument', () => {
  beforeEach(() => {
    sessionStorage.clear();
    localStorage.clear();
    sessionStorage.setItem('surgitrack-demo-role', 'ADMIN');
  });

  it('shows the department as the step it is at, and offers the dispatch', () => {
    const send = vi.fn();
    render(<AssetLifecycle kind="SET" id="x" state="IN_DEPARTMENT" barcode="S000321" onDispatch={send} />, {
      wrapper: Wrapper,
    });
    expect(screen.getByText('Μετά τη χρήση, στείλτε το προς Αποστείρωση.')).toBeInTheDocument();
    expect(screen.getByRole('listitem', {current: 'step'})).toHaveTextContent('Στο τμήμα');
    fireEvent.click(screen.getByRole('button', {name: 'Προς Αποστείρωση'}));
    expect(send).toHaveBeenCalledTimes(1);
  });

  it('shows the stage it waits in, with a link to that stage of Sterilization', () => {
    render(<AssetLifecycle kind="SET" id="x" state="IN_WASHING" barcode="S000321" />, {wrapper: Wrapper});
    expect(screen.getByText('Αναμένει ολοκλήρωση του καθαρισμού.')).toBeInTheDocument();
    expect(screen.getByRole('listitem', {current: 'step'})).toHaveTextContent('Καθαρισμός');
    expect(screen.getByRole('link', {name: /Άνοιγμα στην Αποστείρωση/})).toHaveAttribute(
      'href',
      '/sterilization?queue=WASHING',
    );
  });

  it('shows nothing for what is not on that way', () => {
    const {container} = render(<AssetLifecycle kind="TOOL" id="x" state="IN_STOCK" barcode="T000001" />, {
      wrapper: Wrapper,
    });
    expect(container).toBeEmptyDOMElement();
  });

  it('sends an item in a running load to the running cycles, not to Loading', () => {
    render(<InTheSterilizer />, {wrapper: Wrapper});
    expect(screen.queryByText('no running load')).not.toBeInTheDocument();
    expect(screen.getByRole('link', {name: /Άνοιγμα στην Αποστείρωση/})).toHaveAttribute(
      'href',
      '/sterilization?queue=IN_STERILIZER',
    );
  });
});
