import {fireEvent, render, screen, waitFor} from '@testing-library/react';
import {beforeEach, describe, expect, it, vi} from 'vitest';

const auth = vi.hoisted(() => ({
  onAuthStateChange: vi.fn(() => ({data: {subscription: {unsubscribe: () => undefined}}})),
  updateUser: vi.fn(async () => ({error: null})),
  signOut: vi.fn(async () => ({error: null})),
}));
vi.mock('../../../lib/supabase', () => ({supabase: {auth}}));

const {default: AuthIndex} = await import('../AuthIndex');

beforeEach(() => {
  auth.updateUser.mockClear();
  localStorage.clear();
});

/** The form a reset or invitation link opens: «Ορισμός νέου κωδικού». */
const openReset = () => {
  const view = render(<AuthIndex onAuthenticated={() => undefined} passwordRecovery />);
  const [password, confirm] = view.container.querySelectorAll('input[autocomplete="new-password"]');
  return {...view, password, confirm};
};

describe('Setting a new password', () => {
  it('has the eye button and the rules, ticked off as they are met', () => {
    const {container, password, confirm} = openReset();
    fireEvent.change(password, {target: {value: 'surgitrack1'}});
    fireEvent.change(confirm, {target: {value: 'surgitrack1'}});
    for (const rule of ['Τουλάχιστον 8 χαρακτήρες', 'Ένα γράμμα', 'Ένας αριθμός', 'Οι δύο κωδικοί ταιριάζουν'])
      expect(screen.getByText(rule).closest('li')).toHaveClass('is-ok');
    fireEvent.click(screen.getByRole('button', {name: 'Εμφάνιση κωδικού'}));
    expect(container.querySelectorAll('input[type="password"]')).toHaveLength(0);
  });

  it('refuses a password without a number, and saves a good one', async () => {
    const {container, password, confirm} = openReset();
    fireEvent.change(password, {target: {value: 'onlyletters'}});
    fireEvent.change(confirm, {target: {value: 'onlyletters'}});
    fireEvent.submit(container.querySelector('form')!);
    expect(await screen.findByRole('alert')).toHaveTextContent('με ένα γράμμα και έναν αριθμό');
    expect(auth.updateUser).not.toHaveBeenCalled();

    fireEvent.change(password, {target: {value: 'surgitrack1'}});
    fireEvent.change(confirm, {target: {value: 'surgitrack1'}});
    fireEvent.submit(container.querySelector('form')!);
    await waitFor(() => expect(auth.updateUser).toHaveBeenCalledWith({password: 'surgitrack1'}));
  });
});
