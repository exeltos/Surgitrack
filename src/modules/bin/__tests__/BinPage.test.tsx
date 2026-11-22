import {act, fireEvent, screen, within} from '@testing-library/react';
import {describe, expect, it} from 'vitest';
import {emitBinDraft} from '../../../core/binBridge';
import {renderPage} from '../../../test/renderPage';
import BinPage from '../BinPage';

const now = Date.now();
const DAY = 86_400_000;
const fill = () =>
  act(() => {
    emitBinDraft({
      kind: 'SET',
      label: 'ΣΕΤ ΔΟΚΙΜΗΣ',
      detail: 'S009991',
      deletedAt: new Date(now - DAY).toISOString(),
      payload: {tools: [], toolsDeleted: false},
    });
    emitBinDraft({
      kind: 'TOOL',
      label: 'ΛΑΒΙΔΑ ΔΟΚΙΜΗΣ',
      detail: 'T009992',
      deletedAt: new Date(now - 2 * DAY).toISOString(),
      payload: {tools: [], toolsDeleted: false},
    });
  });
const rows = () => [...document.querySelectorAll('.bin-list li')];

describe('BinPage', () => {
  it('says the bin is empty with a picture', () => {
    renderPage(<BinPage />, {path: '/bin'});
    expect(screen.getByText('Ο Κάδος είναι άδειος')).toBeInTheDocument();
  });

  it('lists what was deleted, newest first, narrows by kind and search, and can be emptied', () => {
    renderPage(<BinPage />, {path: '/bin'});
    fill();
    expect(rows().map(r => r.querySelector('b')?.textContent)).toEqual(['ΣΕΤ ΔΟΚΙΜΗΣ', 'ΛΑΒΙΔΑ ΔΟΚΙΜΗΣ']);
    fireEvent.click(
      within(screen.getByRole('group', {name: 'Γρήγορα φίλτρα'})).getByRole('button', {name: /Εργαλεία/}),
    );
    expect(rows()).toHaveLength(1);
    fireEvent.click(within(screen.getByRole('group', {name: 'Γρήγορα φίλτρα'})).getByRole('button', {name: /Όλα/}));
    fireEvent.change(screen.getByPlaceholderText('Αναζήτηση: όνομα, barcode, ποιος το διέγραψε…'), {
      target: {value: 's009991'},
    });
    expect(rows()).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', {name: /Άδειασμα κάδου/}));
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', {name: 'Άδειασμα κάδου'}));
    expect(screen.getByText('Ο Κάδος είναι άδειος')).toBeInTheDocument();
  });
});
