import {fireEvent, screen, within} from '@testing-library/react';
import {useNavigate} from 'react-router-dom';
import {describe, expect, it} from 'vitest';
import {renderPage} from '../../../test/renderPage';
import ReportsPage from '../ReportsPage';

function Back() {
  const navigate = useNavigate();
  return (
    <button type="button" onClick={() => navigate(-1)}>
      Πίσω
    </button>
  );
}

describe('Αναφορές and the browser’s «Πίσω»', () => {
  it('returns to the report open before, and a link with ?report= opens that one', async () => {
    renderPage(
      <>
        <ReportsPage />
        <Back />
      </>,
      {path: '/reports'},
    );
    fireEvent.click(screen.getByRole('button', {name: /Ιστορικό βλαβών & απωλειών/}));
    expect(screen.getByRole('button', {name: /Ιστορικό βλαβών & απωλειών/})).toHaveClass('active');
    fireEvent.click(screen.getByRole('button', {name: 'Πίσω'}));
    expect(await screen.findByRole('button', {name: /Απογραφή εξοπλισμού/})).toHaveClass('active');
  });

  it('closes the list picked from the summary when «Πίσω» changes the report', async () => {
    renderPage(
      <>
        <ReportsPage />
        <Back />
      </>,
      {path: '/reports'},
    );
    fireEvent.click(screen.getByRole('button', {name: /Ιστορικό βλαβών & απωλειών/}));
    const summary = screen.getByRole('group', {name: 'Σύνολα'});
    const chip = within(summary)
      .getAllByRole('button')
      .find(button => !(button as HTMLButtonElement).disabled)!;
    fireEvent.click(chip);
    expect(chip).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(screen.getByRole('button', {name: 'Πίσω'}));
    expect(await screen.findByRole('button', {name: /Απογραφή εξοπλισμού/})).toHaveClass('active');
    expect(screen.queryByRole('button', {name: 'Εμφάνιση όλων'})).toBeNull();
  });

  it('opens the report the address names', () => {
    renderPage(<ReportsPage />, {path: '/reports?report=issues'});
    expect(screen.getByRole('button', {name: /Ιστορικό βλαβών & απωλειών/})).toHaveClass('active');
  });
});
