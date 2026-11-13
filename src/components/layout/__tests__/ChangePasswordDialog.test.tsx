import {fireEvent, render, screen, waitFor} from '@testing-library/react';
import {beforeEach, describe, expect, it, vi} from 'vitest';

const auth = vi.hoisted(() => ({
  getUser: vi.fn(),
  signInWithPassword: vi.fn(),
  updateUser: vi.fn(),
}));
vi.mock('../../../lib/supabase', () => ({supabase: {auth}}));

const {default: ChangePasswordDialog} = await import('../ChangePasswordDialog');

const fill = (current: string, next: string, again = next) => {
  fireEvent.change(screen.getByLabelText('Τρέχων κωδικός'), {target: {value: current}});
  fireEvent.change(screen.getByLabelText('Νέος κωδικός'), {target: {value: next}});
  fireEvent.change(screen.getByLabelText('Επανάληψη κωδικού'), {target: {value: again}});
};
const save = () => fireEvent.click(screen.getByRole('button', {name: 'Αποθήκευση νέου κωδικού'}));

beforeEach(() => {
  auth.getUser.mockReset().mockResolvedValue({data: {user: {email: 'nurse@example.org'}}});
  auth.signInWithPassword.mockReset();
  auth.updateUser.mockReset();
});

describe('Change password (the menu under the initials)', () => {
  it('checks the current password on this account, then saves the new one', async () => {
    auth.signInWithPassword.mockResolvedValue({data: {user: {id: 'u1'}}, error: null});
    auth.updateUser.mockResolvedValue({error: null});
    render(<ChangePasswordDialog onClose={() => {}} />);
    await waitFor(() => expect(auth.getUser).toHaveBeenCalled());
    fill('old-pass-123', 'newpassword9');
    save();
    expect(await screen.findByText('Ο κωδικός σας άλλαξε. Την επόμενη φορά συνδέεστε με τον νέο.')).toBeInTheDocument();
    expect(auth.signInWithPassword).toHaveBeenCalledWith({email: 'nurse@example.org', password: 'old-pass-123'});
    expect(auth.updateUser).toHaveBeenCalledWith({password: 'newpassword9'});
  });

  it('changes nothing when the current password is wrong', async () => {
    auth.signInWithPassword.mockResolvedValue({data: {user: null}, error: new Error('Invalid login')});
    render(<ChangePasswordDialog onClose={() => {}} />);
    await waitFor(() => expect(auth.getUser).toHaveBeenCalled());
    fill('wrong', 'newpassword9');
    save();
    expect(await screen.findByText('Ο τρέχων κωδικός δεν είναι σωστός.')).toBeInTheDocument();
    expect(auth.updateUser).not.toHaveBeenCalled();
  });

  it('turns down a new password that breaks the rules, before asking the server', async () => {
    render(<ChangePasswordDialog onClose={() => {}} />);
    await waitFor(() => expect(auth.getUser).toHaveBeenCalled());
    fill('old-pass-123', 'short');
    save();
    expect(
      await screen.findByText(
        'Ο νέος κωδικός πρέπει να έχει τουλάχιστον 10 χαρακτήρες, με ένα γράμμα και έναν αριθμό.',
      ),
    ).toBeInTheDocument();
    expect(auth.signInWithPassword).not.toHaveBeenCalled();
  });
});
