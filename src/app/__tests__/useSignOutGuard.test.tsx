import {beforeEach, describe, expect, it, vi} from 'vitest';
import {render, screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const sync = vi.hoisted(() => ({unsavedChanges: vi.fn(), flushPendingWrites: vi.fn()}));
vi.mock('../../data/cloud/useAppRecordSync', () => sync);

const {useSignOutGuard} = await import('../useSignOutGuard');

function Harness({signOut}: {signOut: () => void}) {
  const [node, guard] = useSignOutGuard();
  return (
    <>
      <button onClick={() => guard(signOut)}>Έξοδος</button>
      <button onClick={() => guard(signOut, {direct: true})}>Άλλος χρήστης</button>
      {node}
    </>
  );
}

const start = async (signOut: () => void) => {
  const user = userEvent.setup();
  render(<Harness signOut={signOut} />);
  await user.click(screen.getByRole('button', {name: 'Έξοδος'}));
  await user.click(screen.getByRole('button', {name: 'Αποσύνδεση'}));
  return user;
};

describe('signing out', () => {
  beforeEach(() => {
    sync.unsavedChanges.mockReset();
    sync.flushPendingWrites.mockReset();
  });

  it('signs out after the question when everything is saved', async () => {
    sync.unsavedChanges.mockReturnValue(0);
    const signOut = vi.fn();
    await start(signOut);
    expect(signOut).toHaveBeenCalledTimes(1);
    expect(sync.flushPendingWrites).not.toHaveBeenCalled();
  });

  it('signs out without the question when the user already chose to (screen lock)', async () => {
    sync.unsavedChanges.mockReturnValue(0);
    const signOut = vi.fn();
    const user = userEvent.setup();
    render(<Harness signOut={signOut} />);
    await user.click(screen.getByRole('button', {name: 'Άλλος χρήστης'}));
    expect(screen.queryByText('Θέλετε να αποσυνδεθείτε από το SurgiTrack;')).not.toBeInTheDocument();
    expect(signOut).toHaveBeenCalledTimes(1);
  });

  it('saves what is waiting first, then signs out', async () => {
    sync.unsavedChanges.mockReturnValue(2);
    sync.flushPendingWrites.mockResolvedValue(0);
    const signOut = vi.fn();
    await start(signOut);
    expect(sync.flushPendingWrites).toHaveBeenCalledWith(8000);
    expect(signOut).toHaveBeenCalledTimes(1);
  });

  it('asks again when changes still cannot be saved, staying by default', async () => {
    sync.unsavedChanges.mockReturnValue(3);
    sync.flushPendingWrites.mockResolvedValue(3);
    const signOut = vi.fn();
    const user = await start(signOut);
    expect(await screen.findByText(/3 αλλαγές δεν έχουν αποθηκευτεί ακόμη/)).toBeInTheDocument();
    const stay = screen.getByRole('button', {name: 'Παραμονή'});
    expect(stay).toHaveFocus();
    await user.click(stay);
    expect(signOut).not.toHaveBeenCalled();
    expect(screen.queryByText(/δεν έχουν αποθηκευτεί/)).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', {name: 'Έξοδος'}));
    await user.click(screen.getByRole('button', {name: 'Αποσύνδεση'}));
    await user.click(await screen.findByRole('button', {name: 'Αποσύνδεση χωρίς αποθήκευση'}));
    expect(signOut).toHaveBeenCalledTimes(1);
  });
});
