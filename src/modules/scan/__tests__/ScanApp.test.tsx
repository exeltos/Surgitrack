import {act, fireEvent, render, screen, within} from '@testing-library/react';
import {describe, expect, it, vi} from 'vitest';
import {renderPage} from '../../../test/renderPage';
import ScanApp from '../ScanApp';
import ScanCamera from '../ScanCamera';

/** Types a barcode the way a person does: «Πληκτρολόγηση», the code, «Προσθήκη». */
const typeBarcode = (code: string) => {
  if (!screen.queryByLabelText('Barcode')) fireEvent.click(screen.getByRole('button', {name: /Πληκτρολόγηση/}));
  fireEvent.change(screen.getByLabelText('Barcode'), {target: {value: code}});
  fireEvent.click(screen.getByRole('button', {name: 'Προσθήκη'}));
};

describe('ScanApp', () => {
  it('opens on the stations the signed-in person may use', () => {
    renderPage(<ScanApp onLogout={() => undefined} />, {path: '/scan'});
    const stations = within(screen.getByRole('navigation', {name: 'Σταθμοί'}));
    for (const name of ['Παραλαβή', 'Φόρτωση κλιβάνου', 'Αποδέσμευση', 'Παράδοση', 'Αναζήτηση'])
      expect(stations.getByRole('button', {name: new RegExp(name)})).toBeInTheDocument();
  });

  it('receives what is waiting for receipt and refuses the rest, keeping the refusal in view', () => {
    renderPage(<ScanApp onLogout={() => undefined} />, {path: '/scan/receive'});
    expect(screen.getByRole('button', {name: 'Συνέχεια · 0'})).toBeDisabled();
    typeBarcode('s000327');
    expect(screen.getByText(/S000327 · SET ΕΠΙΣΙΟΤΟΜΗΣ προστέθηκε στην παραλαβή/)).toBeInTheDocument();
    expect(screen.getByText('Παραλαβή από Αίθουσα Τοκετών')).toBeInTheDocument();
    typeBarcode('S999999');
    expect(
      within(screen.getByRole('list', {name: 'Δεν προστέθηκαν'})).getByText(/S999999 δεν βρέθηκε/),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', {name: 'Συνέχεια · 1'}));
    // The person handing over signs before the receipt can be completed.
    expect(screen.getByRole('heading', {name: 'Ολοκλήρωση παραλαβής'})).toBeInTheDocument();
    expect(screen.getByRole('button', {name: /Ολοκλήρωση παραλαβής · 1/})).toBeDisabled();
    expect(screen.getByLabelText('Κωδικός χρήστη')).toBeInTheDocument();
  });

  it('looks up where a Set is and what happened to it last', () => {
    renderPage(<ScanApp onLogout={() => undefined} />, {path: '/scan/lookup'});
    typeBarcode('S000322');
    const card = screen.getByRole('article');
    expect(within(card).getByText('ΛΑΠΑΡΟΣΚΟΠΙΚΟ ΒΑΣΙΚΟ')).toBeInTheDocument();
    expect(within(card).getByText('Έτοιμο για παραλαβή')).toBeInTheDocument();
    expect(within(card).getByRole('heading', {name: 'Τελευταίες κινήσεις'})).toBeInTheDocument();
  });
});

describe('ScanCamera', () => {
  it('takes a Bluetooth/USB scanner’s barcode typed anywhere on the screen', () => {
    localStorage.setItem('surgitrack-scan-camera', 'off');
    const onBarcode = vi.fn();
    render(<ScanCamera onBarcode={onBarcode} />);
    act(() => {
      for (const key of [...'s000327', 'Enter'])
        document.body.dispatchEvent(new KeyboardEvent('keydown', {key, bubbles: true}));
    });
    expect(onBarcode).toHaveBeenCalledWith('S000327');
    localStorage.clear();
  });
});
