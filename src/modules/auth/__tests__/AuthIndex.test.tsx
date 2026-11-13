import {fireEvent, render, screen, waitFor} from '@testing-library/react';
import {beforeEach, describe, expect, it, vi} from 'vitest';

const auth = vi.hoisted(() => ({
  onAuthStateChange: vi.fn(() => ({data: {subscription: {unsubscribe: () => undefined}}})),
  updateUser: vi.fn(async () => ({error: null})),
  signOut: vi.fn(async () => ({error: null})),
}));
const functions = vi.hoisted(() => ({invoke: vi.fn(async () => ({data: {ok: true}, error: null}))}));
vi.mock('../../../lib/supabase', () => ({supabase: {auth, functions}}));

const {default: AuthIndex} = await import('../AuthIndex');

beforeEach(() => {
  auth.updateUser.mockClear();
  auth.signOut.mockClear();
  functions.invoke.mockClear();
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
    for (const rule of ['Τουλάχιστον 10 χαρακτήρες', 'Ένα γράμμα', 'Ένας αριθμός', 'Οι δύο κωδικοί ταιριάζουν'])
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

describe("The first password of someone the owner's import made", () => {
  const FIRST = {deadline: '2026-11-10T00:00:00Z'};
  const openFirst = (onChanged: () => void = () => undefined) => {
    const view = render(
      <AuthIndex onAuthenticated={() => undefined} firstPasswordChange={FIRST} onFirstPasswordChanged={onChanged} />,
    );
    const [password, confirm] = view.container.querySelectorAll('input[autocomplete="new-password"]');
    return {...view, password, confirm};
  };

  it('opens on its own, saying why, by when and with no way into the app but the new password', () => {
    openFirst();
    expect(screen.getByRole('heading', {name: 'Ορίστε τον δικό σας κωδικό'})).toBeInTheDocument();
    expect(screen.getByText(/αντικαταστήστε τον αρχικό κωδικό/)).toBeInTheDocument();
    expect(screen.getByText(/Προθεσμία: 10\/11\/2026/)).toBeInTheDocument();
    expect(screen.queryByText('Κωδικός χρήστη')).not.toBeInTheDocument();
  });

  it('refuses a password that is only digits, such as the mobile number itself', async () => {
    const {container, password, confirm} = openFirst();
    fireEvent.change(password, {target: {value: '6912345678'}});
    fireEvent.change(confirm, {target: {value: '6912345678'}});
    fireEvent.submit(container.querySelector('form')!);
    expect(await screen.findByRole('alert')).toHaveTextContent('με ένα γράμμα και έναν αριθμό');
    expect(functions.invoke).not.toHaveBeenCalled();
  });

  it('changes it on the server, not through the browser, and then lets the person in', async () => {
    const changed = vi.fn();
    const {container, password, confirm} = openFirst(changed);
    fireEvent.change(password, {target: {value: 'surgitrack1'}});
    fireEvent.change(confirm, {target: {value: 'surgitrack1'}});
    fireEvent.submit(container.querySelector('form')!);
    await waitFor(() => expect(changed).toHaveBeenCalled());
    expect(functions.invoke).toHaveBeenCalledWith('change-initial-password', {body: {password: 'surgitrack1'}});
    expect(auth.updateUser).not.toHaveBeenCalled();
  });

  it('keeps the person here, with a message, when the server could not change it', async () => {
    functions.invoke.mockResolvedValueOnce({data: null, error: {message: 'down'}} as never);
    const changed = vi.fn();
    const {container, password, confirm} = openFirst(changed);
    fireEvent.change(password, {target: {value: 'surgitrack1'}});
    fireEvent.change(confirm, {target: {value: 'surgitrack1'}});
    fireEvent.submit(container.querySelector('form')!);
    expect(await screen.findByRole('alert')).toHaveTextContent('Ο κωδικός δεν άλλαξε');
    expect(changed).not.toHaveBeenCalled();
  });

  it('offers to sign out instead of going back to the sign-in form', async () => {
    openFirst();
    fireEvent.click(screen.getByRole('button', {name: /Αποσύνδεση/}));
    await waitFor(() => expect(auth.signOut).toHaveBeenCalled());
  });
});

describe('The way back to the first page', () => {
  it('has both SurgiTrack brands lead to the first page, but not in the phone app', () => {
    const view = render(<AuthIndex onAuthenticated={() => undefined} />);
    const brands = screen.getAllByRole('link', {name: /SurgiTrack/});
    expect(brands).toHaveLength(2);
    for (const brand of brands) expect(brand).toHaveAttribute('href', '#/');
    view.unmount();
    render(<AuthIndex onAuthenticated={() => undefined} scan />);
    expect(screen.queryAllByRole('link', {name: /SurgiTrack/})).toHaveLength(0);
  });
});
