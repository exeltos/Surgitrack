import {fireEvent, render, screen, waitFor} from '@testing-library/react';
import {beforeEach, describe, expect, it, vi} from 'vitest';
import {AppPreferencesProvider} from '../../../../core/AppPreferences';

const invoke = vi.hoisted(() => vi.fn());
vi.mock('../../../../lib/supabase', () => ({supabase: {functions: {invoke}}}));
const {default: StaffAddDialog} = await import('../StaffAddDialog');
type Props = Parameters<typeof StaffAddDialog>[0]['s'];

const changed = vi.fn(async () => undefined);
const state = () =>
  ({
    L: (el: string) => el,
    el: true,
    departments: [
      {id: 'd1', name: 'ΧΕΙΡΟΥΡΓΕΙΟ', code: 'OR', active: true},
      {id: 'd2', name: 'ΑΝΕΝΕΡΓΟ', code: 'X', active: false},
    ],
    members: [{name: 'ΝΙΚΟΣ ΠΑΠΑΣ'}],
    organizationId: 'org-1',
    roleLabel: (id: string) => id,
    changed,
  }) as unknown as Props;
const open = (onClose = vi.fn()) =>
  render(
    <AppPreferencesProvider>
      <StaffAddDialog s={state()} onClose={onClose} />
    </AppPreferencesProvider>,
  );
const fill = (name: string, phone: string) => {
  fireEvent.change(screen.getByLabelText('Ονοματεπώνυμο'), {target: {value: name}});
  fireEvent.change(screen.getByLabelText('Τμήμα'), {target: {value: 'd1'}});
  fireEvent.change(screen.getByLabelText(/Κινητό/), {target: {value: phone}});
};

beforeEach(() => {
  invoke.mockReset();
  changed.mockClear();
});

describe('the owner making one active user', () => {
  it('is not sent until the name, the department and a real mobile number are given', () => {
    open();
    const make = screen.getByRole('button', {name: 'Δημιουργία χρήστη'});
    expect(make).toBeDisabled();
    fill('ΜΑΡΙΑ ΙΩΑΝΝΟΥ', '123');
    expect(screen.getByText(/Το κινητό δεν είναι έγκυρο/)).toBeInTheDocument();
    expect(make).toBeDisabled();
    fill('ΜΑΡΙΑ ΙΩΑΝΝΟΥ', '6912345678');
    expect(make).toBeEnabled();
  });

  it('offers only the active departments, and none for a role with no department', () => {
    open();
    expect(screen.getByRole('option', {name: 'ΧΕΙΡΟΥΡΓΕΙΟ'})).toBeInTheDocument();
    expect(screen.queryByRole('option', {name: 'ΑΝΕΝΕΡΓΟ'})).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Ρόλος'), {target: {value: 'VIEWER'}});
    expect(screen.queryByLabelText('Τμήμα')).not.toBeInTheDocument();
  });

  it('turns a name that already exists away', () => {
    open();
    fill('Νίκος Παπάς', '6912345678');
    expect(screen.getByText(/Υπάρχει ήδη χρήστης/)).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Δημιουργία χρήστη'})).toBeDisabled();
  });

  it('sends one person to the staff import function and shows the username', async () => {
    invoke.mockResolvedValue({
      data: {results: [{index: 0, ok: true, user_code: 'MI4821', emailed: false}], deadline: '16/11/2026'},
      error: null,
    });
    open();
    fill('Μαρία Ιωάννου', '691 234 5678');
    fireEvent.click(screen.getByRole('button', {name: 'Δημιουργία χρήστη'}));
    await waitFor(() => expect(screen.getByText('MI4821')).toBeInTheDocument());
    const [fn, call] = invoke.mock.calls[0];
    expect(fn).toBe('import-staff');
    expect(call.body).toMatchObject({
      organization_id: 'org-1',
      deadline_days: 7,
      send_email: false,
      rows: [{full_name: 'ΜΑΡΙΑ ΙΩΑΝΝΟΥ', department_id: 'd1', role: 'DEPARTMENT', phone: '691 234 5678'}],
    });
    expect(changed).toHaveBeenCalled();
  });

  it('says why the server refused', async () => {
    invoke.mockResolvedValue({data: {results: [{index: 0, ok: false, error: 'email_taken'}]}, error: null});
    open();
    fill('Μαρία Ιωάννου', '6912345678');
    fireEvent.change(screen.getByLabelText(/Προσωπικό email/), {target: {value: 'm@x.gr'}});
    fireEvent.click(screen.getByRole('button', {name: 'Δημιουργία χρήστη'}));
    expect(await screen.findByText('Το email χρησιμοποιείται ήδη')).toBeInTheDocument();
    expect(changed).not.toHaveBeenCalled();
  });
});
