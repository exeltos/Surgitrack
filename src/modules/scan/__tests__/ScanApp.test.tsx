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

describe('ScanApp lookup for a department', () => {
  it('shows only the department’s own equipment', () => {
    renderPage(<ScanApp onLogout={() => undefined} />, {
      path: '/scan/lookup',
      signedIn: {id: 'u-or', name: 'Νοσηλεύτρια Χειρουργείου', role: 'DEPARTMENT', department: 'Χειρουργείο'},
    });
    typeBarcode('S000327');
    expect(screen.queryByRole('article')).not.toBeInTheDocument();
    expect(
      screen.getByText('Ο χρήστης του τμήματος βλέπει μόνο τον εξοπλισμό του δικού του τμήματος.'),
    ).toBeInTheDocument();
    typeBarcode('S000322');
    expect(within(screen.getByRole('article')).getByText('ΛΑΠΑΡΟΣΚΟΠΙΚΟ ΒΑΣΙΚΟ')).toBeInTheDocument();
  });
});

describe('ScanApp lists', () => {
  it('lists the Sets and opens what a Set holds', () => {
    renderPage(<ScanApp onLogout={() => undefined} />, {path: '/scan/lists'});
    fireEvent.change(screen.getByRole('searchbox', {name: 'Αναζήτηση'}), {target: {value: 'S000322'}});
    fireEvent.click(screen.getByRole('button', {name: /ΛΑΠΑΡΟΣΚΟΠΙΚΟ ΒΑΣΙΚΟ/}));
    const contents = screen.getByRole('region', {name: 'Περιεχόμενο Σετ'});
    expect(within(contents).getAllByRole('listitem').length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole('button', {name: /Λίστες/}));
    fireEvent.click(screen.getByRole('button', {name: /Μεμονωμένα/}));
    expect(screen.getByRole('button', {name: /Μεμονωμένα/})).toHaveAttribute('aria-pressed', 'true');
  });

  it('shows a department user only their own department', () => {
    renderPage(<ScanApp onLogout={() => undefined} />, {
      path: '/scan/lists',
      signedIn: {id: 'u-or', name: 'Νοσηλεύτρια Χειρουργείου', role: 'DEPARTMENT', department: 'Χειρουργείο'},
    });
    expect(screen.getByRole('button', {name: /ΛΑΠΑΡΟΣΚΟΠΙΚΟ ΒΑΣΙΚΟ/})).toBeInTheDocument();
    expect(screen.queryByRole('button', {name: /SET ΕΠΙΣΙΟΤΟΜΗΣ/})).not.toBeInTheDocument();
  });
});

describe('ScanApp report', () => {
  const staff = {
    id: 'u-ster',
    name: 'Νοσηλεύτρια Αποστείρωσης',
    role: 'STERILIZATION',
    department: 'Κεντρική Αποστείρωση',
  } as const;

  it('is not among the stations of Sterilization staff', () => {
    renderPage(<ScanApp onLogout={() => undefined} />, {path: '/scan', signedIn: staff});
    expect(screen.queryByRole('button', {name: /Αναφορά/})).not.toBeInTheDocument();
  });

  it('shows the day at Sterilization: activity, stages now, and who did what', () => {
    renderPage(<ScanApp onLogout={() => undefined} />, {
      path: '/scan/report',
      signedIn: {...staff, supervisor: true},
    });
    expect(screen.getByRole('heading', {name: 'Αναφορά'})).toBeInTheDocument();
    expect(screen.getByRole('heading', {name: 'Τώρα στην Αποστείρωση'})).toBeInTheDocument();
    expect(screen.getByText('Αναμονή παραλαβής')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', {name: '7 ημέρες'}));
    expect(screen.getByRole('button', {name: '7 ημέρες'})).toHaveAttribute('aria-pressed', 'true');
  });
});

describe('ScanCamera', () => {
  it('takes a Bluetooth/USB scanner’s barcode typed anywhere on the screen', () => {
    const onBarcode = vi.fn();
    render(<ScanCamera onBarcode={onBarcode} />);
    act(() => {
      for (const key of [...'s000327', 'Enter'])
        document.body.dispatchEvent(new KeyboardEvent('keydown', {key, bubbles: true}));
    });
    expect(onBarcode).toHaveBeenCalledWith('S000327');
  });

  it('opens the camera only when «Σάρωση» is pressed', () => {
    const {container} = render(<ScanCamera onBarcode={vi.fn()} />);
    expect(container.querySelector('video')).toBeNull();
    fireEvent.click(screen.getByRole('button', {name: 'Σάρωση'}));
    expect(container.querySelector('video')).not.toBeNull();
    fireEvent.click(screen.getByRole('button', {name: /Κλείσιμο κάμερας/}));
    expect(container.querySelector('video')).toBeNull();
  });
});
