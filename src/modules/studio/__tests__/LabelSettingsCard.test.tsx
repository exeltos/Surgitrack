import {describe, expect, it} from 'vitest';
import {fireEvent, screen, within} from '@testing-library/react';
import LabelSettingsCard from '../LabelSettingsCard';
import {renderPage} from '../../../test/renderPage';

const L = (el: string) => el;

describe('Barcode label settings', () => {
  it('previews a sterile Set with its dates and keeps the changes as the default on closing', () => {
    renderPage(<LabelSettingsCard L={L} />, {
      signedIn: {id: 'u-admin', name: 'Διαχειριστής', role: 'ADMIN', department: ''},
    });
    fireEvent.click(screen.getByRole('button', {name: /Ρύθμιση & προεπισκόπηση/}));
    const frame = document.querySelector('iframe') as HTMLIFrameElement;
    expect(frame.getAttribute('srcdoc')).toContain('class="dates"');
    fireEvent.click(screen.getByRole('button', {name: /Τριπλή/}));
    expect(screen.getByRole('button', {name: /Ορισμός ως προεπιλογή νοσοκομείου/})).toBeTruthy();
    fireEvent.click(screen.getAllByRole('button', {name: 'Κλείσιμο'}).at(-1)!);
    const summary = document.querySelector('.label-settings-summary') as HTMLElement;
    expect(within(summary).getByText(/Τριπλή/)).toBeTruthy();
  });

  it('saves nothing on closing when nothing was changed here', () => {
    renderPage(<LabelSettingsCard L={L} />, {
      signedIn: {id: 'u-admin', name: 'Διαχειριστής', role: 'ADMIN', department: ''},
    });
    const summary = document.querySelector('.label-settings-summary') as HTMLElement;
    const before = summary.textContent;
    fireEvent.click(screen.getByRole('button', {name: /Ρύθμιση & προεπισκόπηση/}));
    expect(screen.getByText('Είναι η προεπιλογή νοσοκομείου')).toBeTruthy();
    fireEvent.click(screen.getAllByRole('button', {name: 'Κλείσιμο'}).at(-1)!);
    expect(summary.textContent).toBe(before);
  });
});
