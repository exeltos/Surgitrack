import {fireEvent, screen, waitFor, within} from '@testing-library/react';
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

describe('Replacing an instrument from its report', () => {
  it('shows where the same instrument is, and one from Stock takes its place in the Set', async () => {
    const {replacementItems} = await import('../../../core/replacements');
    const {sets, movements} = await import('../../../data/demo');
    // A damaged instrument in a Set, with the same one waiting in Stock.
    const item = replacementItems({tools, retiredTools: [], sets, issues, movements, purchaseOrders: []}).find(
      i => i.reason === 'DAMAGED' && i.tool.setId && i.stock.length,
    )!;
    renderPage(<ToolDetailPage />, {
      path: `/tools/${item.tool.id}`,
      route: '/tools/:id',
      signedIn: {id: 'u-admin', name: 'Διαχειριστής', role: 'ADMIN', department: 'Κεντρική Αποστείρωση'},
    });
    fireEvent.click(screen.getByRole('button', {name: /^Εκκρεμότητες/}));
    fireEvent.click(screen.getAllByRole('button', {name: 'Αντικατάσταση'})[0]);
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByRole('tab', {name: /Απόθεμα/})).toHaveAttribute('aria-selected', 'true');
    const choices = within(dialog).getAllByRole('radio');
    expect(choices).toHaveLength(item.stock.length);
    fireEvent.click(choices[0]);
    fireEvent.click(within(dialog).getByRole('button', {name: 'Αντικατάσταση'}));
    // Done: the dialog closes and the instrument replaced has gone to Service.
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect((await screen.findAllByText('Service')).length).toBeGreaterThan(0);
  });
});
