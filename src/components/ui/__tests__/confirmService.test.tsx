import {describe, expect, it} from 'vitest';
import {render, screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {askConfirm, ConfirmHost, tellUser} from '../confirmService';

describe('the app confirmation from anywhere', () => {
  it('resolves to an empty string on confirm and false on cancel', async () => {
    const user = userEvent.setup();
    render(<ConfirmHost />);
    const yes = askConfirm({title: 'Διαγραφή', message: 'Σίγουρα;', confirmLabel: 'Διαγραφή'});
    await user.click(await screen.findByRole('button', {name: 'Διαγραφή'}));
    await expect(yes).resolves.toBe('');
    const no = askConfirm({title: 'Διαγραφή', message: 'Σίγουρα;', confirmLabel: 'Διαγραφή'});
    await user.click(await screen.findByRole('button', {name: 'Ακύρωση'}));
    await expect(no).resolves.toBe(false);
  });

  it('hands back the note, and keeps confirm off while a required note is empty', async () => {
    const user = userEvent.setup();
    render(<ConfirmHost />);
    const answer = askConfirm({
      title: 'Ανάκληση',
      message: 'Το φορτίο ανακαλείται.',
      note: {label: 'Αιτιολογία', required: true},
      confirmLabel: 'Ανάκληση φορτίου',
    });
    const confirm = await screen.findByRole('button', {name: 'Ανάκληση φορτίου'});
    expect(confirm).toBeDisabled();
    await user.type(screen.getByLabelText('Αιτιολογία'), 'BI ανεπιτυχής');
    await user.click(confirm);
    await expect(answer).resolves.toBe('BI ανεπιτυχής');
  });

  it('shows a notice with a single button', async () => {
    const user = userEvent.setup();
    render(<ConfirmHost />);
    const done = tellUser('Το Demo επανήλθε', 'Έτοιμο.');
    expect(await screen.findByText('Το Demo επανήλθε')).toBeInTheDocument();
    expect(screen.queryByRole('button', {name: 'Ακύρωση'})).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', {name: 'OK'}));
    await expect(done).resolves.toBeUndefined();
  });
});
