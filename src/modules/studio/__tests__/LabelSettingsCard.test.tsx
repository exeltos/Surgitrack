import {describe, expect, it} from 'vitest';
import {fireEvent, screen} from '@testing-library/react';
import LabelSettingsCard from '../LabelSettingsCard';
import {renderPage} from '../../../test/renderPage';

const L = (el: string) => el;

describe('Barcode label settings', () => {
  it('previews a sterile Set with its dates and keeps the changes as the default on closing', () => {
    renderPage(<LabelSettingsCard L={L} />, {
      signedIn: {id: 'u-admin', name: 'Διαχειριστής', role: 'ADMIN', department: ''},
    });
    fireEvent.click(screen.getByRole('button', {name: /Επεξεργασία ετικέτας/}));
    const frame = document.querySelector('iframe') as HTMLIFrameElement;
    expect(frame.getAttribute('srcdoc')).toContain('class="dates"');
    fireEvent.click(screen.getByRole('button', {name: /Τριπλή/}));
    expect(screen.getByRole('button', {name: /Ορισμός ως προεπιλογή νοσοκομείου/})).toBeTruthy();
    fireEvent.click(screen.getAllByRole('button', {name: 'Κλείσιμο'}).at(-1)!);
    // The size chosen is now the hospital's default: opened again, the editor says so and offers nothing to set.
    fireEvent.click(screen.getByRole('button', {name: /Επεξεργασία ετικέτας/}));
    expect(screen.getByText('Είναι η προεπιλογή νοσοκομείου')).toBeTruthy();
    expect(screen.queryByRole('button', {name: /Ορισμός ως προεπιλογή νοσοκομείου/})).toBeNull();
  });

  it('saves nothing on closing when nothing was changed here', () => {
    renderPage(<LabelSettingsCard L={L} />, {
      signedIn: {id: 'u-admin', name: 'Διαχειριστής', role: 'ADMIN', department: ''},
    });
    fireEvent.click(screen.getByRole('button', {name: /Επεξεργασία ετικέτας/}));
    expect(screen.getByText('Είναι η προεπιλογή νοσοκομείου')).toBeTruthy();
    fireEvent.click(screen.getAllByRole('button', {name: 'Κλείσιμο'}).at(-1)!);
    // Nothing was changed, so nothing was saved: the editor still shows the same default.
    fireEvent.click(screen.getByRole('button', {name: /Επεξεργασία ετικέτας/}));
    expect(screen.getByText('Είναι η προεπιλογή νοσοκομείου')).toBeTruthy();
  });
});
