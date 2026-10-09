import {describe, expect, it} from 'vitest';
import {useState} from 'react';
import {fireEvent, render, screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {HashRouter, Link, Route, Routes} from 'react-router-dom';
import {UnsavedChangesProvider, useGuardedNavigate, useUnsavedChanges} from '../UnsavedChanges';

function Form() {
  const [text, setText] = useState('');
  useUnsavedChanges(!!text);
  const go = useGuardedNavigate();
  return (
    <>
      <input aria-label="Όνομα" value={text} onChange={e => setText(e.target.value)} />
      <Link to="/other">Σύνδεσμος</Link>
      <button onClick={() => go('/other')}>Κουμπί</button>
    </>
  );
}

const setup = () => {
  window.location.hash = '#/';
  render(
    <HashRouter>
      <UnsavedChangesProvider>
        <Routes>
          <Route path="/" element={<Form />} />
          <Route path="/other" element={<p>Άλλη σελίδα</p>} />
        </Routes>
      </UnsavedChangesProvider>
    </HashRouter>,
  );
  return userEvent.setup();
};

describe('leaving a screen with unsaved changes', () => {
  it('leaves at once when nothing was typed', async () => {
    const user = setup();
    await user.click(screen.getByText('Σύνδεσμος'));
    expect(screen.getByText('Άλλη σελίδα')).toBeInTheDocument();
  });

  it('asks before following a link, and staying keeps the draft', async () => {
    const user = setup();
    await user.type(screen.getByLabelText('Όνομα'), 'Λαβίδα');
    await user.click(screen.getByText('Σύνδεσμος'));
    expect(screen.getByText('Υπάρχουν αλλαγές που δεν αποθηκεύτηκαν')).toBeInTheDocument();
    await user.click(screen.getByRole('button', {name: 'Παραμονή'}));
    expect(screen.getByLabelText('Όνομα')).toHaveValue('Λαβίδα');
    expect(screen.queryByText('Άλλη σελίδα')).not.toBeInTheDocument();
  });

  it('leaves after the user agrees, from a button too', async () => {
    const user = setup();
    await user.type(screen.getByLabelText('Όνομα'), 'Λαβίδα');
    await user.click(screen.getByRole('button', {name: 'Κουμπί'}));
    await user.click(screen.getByRole('button', {name: 'Έξοδος χωρίς αποθήκευση'}));
    expect(screen.getByText('Άλλη σελίδα')).toBeInTheDocument();
  });

  it('lets the browser ask before closing the tab', async () => {
    const user = setup();
    await user.type(screen.getByLabelText('Όνομα'), 'Λαβίδα');
    const event = new Event('beforeunload', {cancelable: true});
    fireEvent(window, event);
    expect(event.defaultPrevented).toBe(true);
  });
});
