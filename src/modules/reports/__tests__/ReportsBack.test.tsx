import {fireEvent, screen} from '@testing-library/react';
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
    fireEvent.click(screen.getByRole('button', {name: /Service & βλάβες/}));
    expect(screen.getByRole('button', {name: /Service & βλάβες/})).toHaveClass('active');
    fireEvent.click(screen.getByRole('button', {name: 'Πίσω'}));
    expect(await screen.findByRole('button', {name: /Απογραφή εξοπλισμού/})).toHaveClass('active');
  });

  it('opens the report the address names', () => {
    renderPage(<ReportsPage />, {path: '/reports?report=issues'});
    expect(screen.getByRole('button', {name: /Service & βλάβες/})).toHaveClass('active');
  });
});
