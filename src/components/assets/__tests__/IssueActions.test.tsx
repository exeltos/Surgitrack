import {fireEvent, screen, within} from '@testing-library/react';
import {describe, expect, it} from 'vitest';
import {renderPage} from '../../../test/renderPage';
import {issues, tools} from '../../../data/demo';
import ToolDetailPage from '../../../modules/tools/ToolDetailPage';

describe('An open report on the instrument’s «Εκκρεμότητες»', () => {
  it('says what can be done, and «Ελέγχθηκε · σε χρήση» closes it with how', () => {
    const issue = issues.find(i => i.id === 'i9')!;
    const tool = tools.find(t => issue.asset.startsWith(`${t.barcode} `))!;
    renderPage(<ToolDetailPage />, {
      path: `/tools/${tool.id}`,
      route: '/tools/:id',
      signedIn: {id: 'u-admin', name: 'Διαχειριστής', role: 'ADMIN', department: 'Κεντρική Αποστείρωση'},
    });
    fireEvent.click(screen.getByRole('button', {name: /^Εκκρεμότητες/}));
    expect(screen.getByRole('button', {name: 'Service, Απόθεμα…'})).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', {name: 'Ελέγχθηκε · σε χρήση'}));
    const dialog = screen.getByRole('dialog');
    fireEvent.change(within(dialog).getByRole('textbox'), {target: {value: 'Ακονίστηκε'}});
    fireEvent.click(within(dialog).getByRole('button', {name: 'Επίλυση'}));
    expect(screen.getByText('Δεν υπάρχουν ανοικτές εκκρεμότητες.')).toBeInTheDocument();
  });
});
