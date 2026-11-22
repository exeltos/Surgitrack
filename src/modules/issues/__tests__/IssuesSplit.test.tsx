import {fireEvent, screen, within} from '@testing-library/react';
import {describe, expect, it} from 'vitest';
import {renderPage} from '../../../test/renderPage';
import IssuesPage from '../IssuesPage';

const list = () => screen.getByRole('complementary', {name: 'Λίστα εκκρεμοτήτων'});
const card = () => screen.getByRole('region', {name: 'Πρόβλημα'});

describe('Εκκρεμότητες › Προβλήματα', () => {
  it('lists the reports on the left and opens the one picked on the right', () => {
    renderPage(<IssuesPage />, {path: '/issues'});
    const rows = within(list())
      .getAllByRole('button')
      .filter(b => b.closest('.issues-list'));
    expect(rows.length).toBeGreaterThan(1);
    // The first opens by itself.
    expect(rows[0]).toHaveAttribute('aria-current', 'true');
    const second = rows[1].querySelector('.issue-row-name')!.textContent!;
    fireEvent.click(rows[1]);
    expect(within(card()).getByRole('heading', {level: 2})).toHaveTextContent(second);
    expect(rows[1]).toHaveAttribute('aria-current', 'true');
    expect(within(card()).getByText('Τύπος')).toBeInTheDocument();
  });
});
