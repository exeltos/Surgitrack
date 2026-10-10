import {fireEvent, render, screen, waitFor} from '@testing-library/react';
import {FunctionsHttpError} from '@supabase/supabase-js';
import {beforeEach, describe, expect, it, vi} from 'vitest';
import {AppPreferencesProvider} from '../../../core/AppPreferences';

const invoke = vi.hoisted(() => vi.fn());
vi.mock('../../../lib/supabase', () => ({supabase: {functions: {invoke}}}));

const {default: JoinPage} = await import('../JoinPage');

const open = (props: {token: string; confirm?: boolean}) =>
  render(
    <AppPreferencesProvider>
      <JoinPage {...props} />
    </AppPreferencesProvider>,
  );
const httpError = (status: number) => new FunctionsHttpError(new Response('{}', {status}));

const INFO = {
  organization_name: 'ΙΑΣΩ Θεσσαλίας',
  expires_at: null,
  email: null,
  department_id: null,
  needs_department: true,
  departments: [{id: 'dept-1', name: 'Χειρουργείο', code: 'XR'}],
};

beforeEach(() => {
  invoke.mockReset();
  localStorage.clear();
});

describe('Signup email confirmation', () => {
  it('confirms the emailed link and says the request went for approval', async () => {
    invoke.mockResolvedValue({data: {ok: true, organization_name: 'ΙΑΣΩ Θεσσαλίας'}, error: null});
    open({token: 'c0ffee00c0ffee00', confirm: true});
    expect(await screen.findByText('Αναμονή έγκρισης')).toBeInTheDocument();
    expect(screen.getByText(/ΙΑΣΩ Θεσσαλίας/)).toBeInTheDocument();
    expect(invoke).toHaveBeenCalledWith('staff-signup', {body: {action: 'confirm', token: 'c0ffee00c0ffee00'}});
  });

  it('says when the link expired or was used', async () => {
    invoke.mockResolvedValue({data: null, error: httpError(410)});
    open({token: 'c0ffee00c0ffee00', confirm: true});
    expect(await screen.findByText('Ο σύνδεσμος δεν είναι έγκυρος')).toBeInTheDocument();
  });

  it('after signing up through the hospital link, asks to confirm the email first', async () => {
    invoke.mockImplementation(async (_name: string, {body}: {body: Record<string, unknown>}) =>
      body.action === 'info'
        ? {data: INFO, error: null}
        : {data: {ok: true, user_code: 'GN1234', confirm: true}, error: null},
    );
    const {container} = open({token: 'aaaaaaaaaaaaaaaa'});
    await screen.findByText('ΙΑΣΩ Θεσσαλίας');
    const inputs = container.querySelectorAll('input');
    fireEvent.change(inputs[0], {target: {value: 'Γιώργος'}});
    fireEvent.change(inputs[1], {target: {value: 'Νικολάου'}});
    fireEvent.change(container.querySelector('input[name="email"]')!, {target: {value: 'g@hospital.gr'}});
    fireEvent.change(container.querySelector('select')!, {target: {value: 'dept-1'}});
    for (const input of container.querySelectorAll('input[type="password"]'))
      fireEvent.change(input, {target: {value: 'secret-123'}});
    fireEvent.submit(container.querySelector('form')!);
    expect(await screen.findByText('Ελέγξτε το email σας')).toBeInTheDocument();
    expect(screen.getByText(/Στείλαμε email στο g@hospital.gr/)).toBeInTheDocument();
    await waitFor(() =>
      expect(invoke.mock.calls.at(-1)?.[1].body).toMatchObject({
        origin: window.location.origin,
        token: 'aaaaaaaaaaaaaaaa',
      }),
    );
  });
});

describe('Signup password', () => {
  const form = async () => {
    invoke.mockImplementation(async (_name: string, {body}: {body: Record<string, unknown>}) =>
      body.action === 'info' ? {data: INFO, error: null} : {data: {ok: true, user_code: 'GN1234'}, error: null},
    );
    const view = open({token: 'aaaaaaaaaaaaaaaa'});
    await screen.findByText('ΙΑΣΩ Θεσσαλίας');
    return view;
  };

  it('shows and hides both passwords with one button', async () => {
    const {container} = await form();
    expect(container.querySelectorAll('input[type="password"]')).toHaveLength(2);
    fireEvent.click(screen.getByRole('button', {name: 'Εμφάνιση κωδικού'}));
    expect(container.querySelectorAll('input[type="password"]')).toHaveLength(0);
    fireEvent.click(screen.getByRole('button', {name: 'Απόκρυψη κωδικού'}));
    expect(container.querySelectorAll('input[type="password"]')).toHaveLength(2);
  });

  it('ticks off the rules as they are met, and refuses a weak password before sending', async () => {
    const {container} = await form();
    const inputs = container.querySelectorAll('input');
    fireEvent.change(inputs[0], {target: {value: 'Γιώργος'}});
    fireEvent.change(inputs[1], {target: {value: 'Νικολάου'}});
    fireEvent.change(container.querySelector('input[name="email"]')!, {target: {value: 'g@hospital.gr'}});
    fireEvent.change(container.querySelector('select')!, {target: {value: 'dept-1'}});
    const [password, confirm] = container.querySelectorAll('input[type="password"]');
    fireEvent.change(password, {target: {value: 'onlyletters'}});
    fireEvent.change(confirm, {target: {value: 'onlyletters'}});
    const rule = (text: string) => screen.getByText(text).closest('li')!;
    expect(rule('Τουλάχιστον 8 χαρακτήρες')).toHaveClass('is-ok');
    expect(rule('Ένα γράμμα')).toHaveClass('is-ok');
    expect(rule('Ένας αριθμός')).not.toHaveClass('is-ok');
    expect(rule('Οι δύο κωδικοί ταιριάζουν')).toHaveClass('is-ok');
    fireEvent.submit(container.querySelector('form')!);
    expect(await screen.findByRole('alert')).toHaveTextContent('με ένα γράμμα και έναν αριθμό');
    expect(invoke.mock.calls.every(([, {body}]) => body.action === 'info')).toBe(true);
  });
});
