import {fireEvent, screen} from '@testing-library/react';
import {useNavigate} from 'react-router-dom';
import {describe, expect, it} from 'vitest';
import {renderPage} from '../../../test/renderPage';
import TraceabilityPage from '../TraceabilityPage';

/** The browser's «Πίσω». */
function Back() {
  const navigate = useNavigate();
  return (
    <button type="button" onClick={() => navigate(-1)}>
      Πίσω
    </button>
  );
}
const field = () => screen.getByRole('textbox', {name: 'Barcode (S..., T...) ή όνομα Σετ/εργαλείου'});

describe('Ιχνηλάτηση and the browser’s «Πίσω»', () => {
  it('steps back through the tabs and the searches, one at a time', async () => {
    renderPage(
      <>
        <TraceabilityPage />
        <Back />
      </>,
      {path: '/traceability'},
    );
    fireEvent.change(field(), {target: {value: 'S000321'}});
    fireEvent.submit(field().closest('form')!);
    fireEvent.click(screen.getByRole('tab', {name: /Ασθενής/}));
    expect(screen.queryByRole('textbox', {name: 'Barcode (S..., T...) ή όνομα Σετ/εργαλείου'})).toBeNull();
    // Back: the search and its result, as left.
    fireEvent.click(screen.getByRole('button', {name: 'Πίσω'}));
    expect(await screen.findByRole('link', {name: /Άνοιγμα καρτέλας/})).toBeInTheDocument();
    expect(field()).toHaveValue('S000321');
    // Back again: the empty search.
    fireEvent.click(screen.getByRole('button', {name: 'Πίσω'}));
    await screen.findByText('Σκανάρετε ή πληκτρολογήστε barcode (S..., T...) ή όνομα.');
    expect(field()).toHaveValue('');
  });

  it('a recent search picked again fills the field, even when it is the one in the address', () => {
    renderPage(<TraceabilityPage />, {path: '/traceability'});
    fireEvent.change(field(), {target: {value: 'S000321'}});
    fireEvent.submit(field().closest('form')!);
    fireEvent.change(field(), {target: {value: ''}});
    fireEvent.click(screen.getByRole('button', {name: 'S000321'}));
    expect(field()).toHaveValue('S000321');
  });
});
